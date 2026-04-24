const { query } = require('../config/db');

async function findUserByEmail(email) {
  const rows = await query(
    'SELECT id, name, email, password_hash, avatar_data, avatar_mime FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash, avatarBuffer = null, avatarMime = null }) {
  const result = await query(
    'INSERT INTO users (name, email, password_hash, avatar_data, avatar_mime) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, avatarBuffer, avatarMime]
  );

  await query('INSERT INTO user_points (user_id, total_points) VALUES (?, 0)', [result.insertId]);

  return { id: result.insertId, name, email };
}

module.exports = {
  findUserByEmail,
  createUser,
};
