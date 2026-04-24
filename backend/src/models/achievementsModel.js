const { pool, query } = require('../config/db');

const ACHIEVEMENT_KEYS = {
  first_friend_request_sent: 'first_friend_request_sent',
  first_friend_request_accepted: 'first_friend_request_accepted',
  first_private_message: 'first_private_message',
  first_group_created: 'first_group_created',
  first_multimedia_message: 'first_multimedia_message',
  first_task_created: 'first_task_created',
  first_task_completed: 'first_task_completed',
  first_avatar_change: 'first_avatar_change',
};

async function getUserAchievementState(userId) {
  const pointsRows = await query(
    'SELECT total_points FROM user_points WHERE user_id = ? LIMIT 1',
    [userId]
  );

  const rewardsRows = await query(
    `SELECT ur.reward_id, r.name, r.description, r.points_cost, ur.redeemed_at
     FROM user_rewards ur
     INNER JOIN rewards r ON r.id = ur.reward_id
     WHERE ur.user_id = ?
     ORDER BY ur.redeemed_at DESC`,
    [userId]
  );

  const achievementsRows = await query(
    `SELECT a.key_name, a.title, a.description, a.points_reward, ua.unlocked_at
     FROM user_achievements ua
     INNER JOIN achievements a ON a.id = ua.achievement_id
     WHERE ua.user_id = ?
     ORDER BY ua.unlocked_at DESC`,
    [userId]
  );

  return {
    total_points: Number(pointsRows[0]?.total_points || 0),
    redeemed_rewards: rewardsRows,
    unlocked_achievement_keys: achievementsRows.map((row) => row.key_name),
    unlocked_achievements: achievementsRows,
  };
}

async function unlockAchievementByKey(userId, keyName) {
  const achievementRows = await query(
    `SELECT id, key_name, title, points_reward, is_active
     FROM achievements
     WHERE key_name = ?
     LIMIT 1`,
    [keyName]
  );

  const achievement = achievementRows[0];
  if (!achievement || achievement.is_active !== 1) {
    return { unlocked: false };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [insertResult] = await conn.execute(
      `INSERT IGNORE INTO user_achievements (user_id, achievement_id)
       VALUES (?, ?)`,
      [userId, achievement.id]
    );

    if (!insertResult.affectedRows) {
      await conn.commit();
      return { unlocked: false, alreadyUnlocked: true };
    }

    await conn.execute(
      'UPDATE user_points SET total_points = total_points + ? WHERE user_id = ?',
      [achievement.points_reward, userId]
    );

    await conn.commit();
    return {
      unlocked: true,
      alreadyUnlocked: false,
      key_name: achievement.key_name,
      title: achievement.title,
      points_reward: achievement.points_reward,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function unlockIfFirstOccurrence({ userId, keyName, countSql, countParams = [] }) {
  const countRows = await query(countSql, countParams);
  const total = Number(countRows[0]?.total || 0);

  if (total < 1) {
    return { unlocked: false, total };
  }

  return unlockAchievementByKey(userId, keyName);
}

async function awardFirstFriendRequestSent(userId) {
  return unlockIfFirstOccurrence({
    userId,
    keyName: ACHIEVEMENT_KEYS.first_friend_request_sent,
    countSql: 'SELECT COUNT(*) AS total FROM friend_requests WHERE requester_id = ?',
    countParams: [userId],
  });
}

async function awardFirstFriendRequestAccepted(userId) {
  return unlockIfFirstOccurrence({
    userId,
    keyName: ACHIEVEMENT_KEYS.first_friend_request_accepted,
    countSql: `SELECT COUNT(*) AS total
               FROM friend_requests
               WHERE (receiver_id = ? OR requester_id = ?)
                 AND status = 'accepted'`,
    countParams: [userId, userId],
  });
}

async function awardFirstPrivateMessage(userId) {
  return unlockIfFirstOccurrence({
    userId,
    keyName: ACHIEVEMENT_KEYS.first_private_message,
    countSql: `SELECT COUNT(*) AS total
               FROM messages m
               INNER JOIN chats c ON c.id = m.chat_id
               WHERE m.sender_id = ?
                 AND c.type = 'private'
                 AND m.message_type = 'text'`,
    countParams: [userId],
  });
}

async function awardFirstGroupCreated(userId) {
  return unlockIfFirstOccurrence({
    userId,
    keyName: ACHIEVEMENT_KEYS.first_group_created,
    countSql: "SELECT COUNT(*) AS total FROM chats WHERE created_by = ? AND type = 'group'",
    countParams: [userId],
  });
}

async function awardFirstMultimediaMessage(userId) {
  return unlockIfFirstOccurrence({
    userId,
    keyName: ACHIEVEMENT_KEYS.first_multimedia_message,
    countSql: `SELECT COUNT(*) AS total
               FROM messages
               WHERE sender_id = ?
                 AND message_type IN ('image', 'video')`,
    countParams: [userId],
  });
}

async function awardFirstTaskCreated(userId) {
  return unlockIfFirstOccurrence({
    userId,
    keyName: ACHIEVEMENT_KEYS.first_task_created,
    countSql: 'SELECT COUNT(*) AS total FROM tasks WHERE created_by = ?',
    countParams: [userId],
  });
}

async function awardFirstTaskCompleted(userId) {
  return unlockIfFirstOccurrence({
    userId,
    keyName: ACHIEVEMENT_KEYS.first_task_completed,
    countSql: 'SELECT COUNT(*) AS total FROM task_completions WHERE user_id = ?',
    countParams: [userId],
  });
}

async function awardFirstAvatarChange(userId) {
  return unlockAchievementByKey(userId, ACHIEVEMENT_KEYS.first_avatar_change);
}

module.exports = {
  getUserAchievementState,
  unlockAchievementByKey,
  awardFirstFriendRequestSent,
  awardFirstFriendRequestAccepted,
  awardFirstPrivateMessage,
  awardFirstGroupCreated,
  awardFirstMultimediaMessage,
  awardFirstTaskCreated,
  awardFirstTaskCompleted,
  awardFirstAvatarChange,
};