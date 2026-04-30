const { query, pool } = require(`../config/db`);

function getRandomTaskPoints() {
  return Math.floor(Math.random() * 21) + 5;
}

async function createTask({ chatId, title, description, createdBy, dueDate = null, locationUrl = null }) {
  const points = getRandomTaskPoints();
  const result = await query(
    `INSERT INTO tasks (chat_id, title, description, created_by, points, location_url, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [chatId, title, description, createdBy, points, locationUrl, dueDate]
  );

  return {
    id: result.insertId,
    chat_id: chatId,
    title,
    description,
    created_by: createdBy,
    points,
    location_url: locationUrl,
    due_date: dueDate,
  };
}

async function getTasksByGroup(groupId) {
  return query(
    `SELECT t.id, t.chat_id, t.title, t.description, t.created_by, 
            u.name AS creator_name, t.points, t.location_url, t.status, t.due_date, t.created_at, t.completed_at
     FROM tasks t
     INNER JOIN users u ON u.id = t.created_by
     WHERE t.chat_id = ?
     ORDER BY t.status ASC, t.created_at DESC`,
    [groupId]
  );
}

async function completeTask({ taskId, userId }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [taskRows] = await connection.execute(
      `SELECT id, chat_id, points, status FROM tasks WHERE id = ? LIMIT 1 FOR UPDATE`,
      [taskId]
    );
    const task = taskRows[0];

    if (!task) {
      throw new Error(`Tarea no encontrada`);
    }

    if (task.status === `done`) {
      await connection.commit();
      return { alreadyDone: true, points: task.points };
    }

    const [memberRows] = await connection.execute(
      `SELECT user_id FROM chat_members WHERE chat_id = ?`,
      [task.chat_id]
    );

    const memberIds = [...new Set(memberRows.map((row) => Number(row.user_id)).filter(Boolean))];

    await connection.execute(
      `UPDATE tasks SET status = 'done', completed_at = NOW() WHERE id = ?`,
      [taskId]
    );

    await connection.execute(
      `INSERT INTO task_completions (task_id, user_id) VALUES (?, ?)`,
      [taskId, userId]
    );

    for (const memberId of memberIds) {
      await connection.execute(
        `UPDATE user_points SET total_points = total_points + ? WHERE user_id = ?`,
        [task.points, memberId]
      );
    }

    await connection.commit();
    return { alreadyDone: false, points: task.points, memberCount: memberIds.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createTask,
  getTasksByGroup,
  completeTask,
};
