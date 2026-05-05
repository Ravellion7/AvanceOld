const { query } = require('../config/db');

async function listUsers() {
  return query(
    `SELECT id, name, email, is_online, last_seen, created_at,
            CASE
              WHEN avatar_data IS NULL THEN NULL
              ELSE CONCAT('data:', COALESCE(avatar_mime, 'image/jpeg'), ';base64,', REPLACE(REPLACE(TO_BASE64(avatar_data), '\n', ''), '\r', ''))
            END AS avatar
     FROM users
     ORDER BY name ASC`
  );
}

async function updateUserStatus(userId, isOnline) {
  await query(
    'UPDATE users SET is_online = ?, last_seen = NOW() WHERE id = ?',
    [isOnline ? 1 : 0, userId]
  );
}

async function updateUserAvatar(userId, avatarBuffer, avatarMime) {
  await query(
    'UPDATE users SET avatar_data = ?, avatar_mime = ? WHERE id = ?',
    [avatarBuffer, avatarMime, userId]
  );
}

module.exports = {
  listUsers,
  updateUserStatus,
  updateUserAvatar,
};
