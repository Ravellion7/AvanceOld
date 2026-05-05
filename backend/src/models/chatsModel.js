const { query, pool } = require('../config/db');

async function createPrivateChat(userA, userB) {
  const rows = await query(
    `SELECT c.id
     FROM chats c
     INNER JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
     INNER JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
     WHERE c.type = 'private'
     LIMIT 1`,
    [userA, userB]
  );

  if (rows[0]) {
    return rows[0].id;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [chatResult] = await conn.execute(
      "INSERT INTO chats (type, name, created_by) VALUES ('private', NULL, ?)",
      [userA]
    );

    await conn.execute(
      "INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'member'), (?, ?, 'member')",
      [chatResult.insertId, userA, chatResult.insertId, userB]
    );

    await conn.commit();
    return chatResult.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function createGroupChat({ name, createdBy, memberIds }) {
  if (!Array.isArray(memberIds)) {
    throw new Error('memberIds debe ser un arreglo');
  }

  const uniqueIds = [...new Set(memberIds.map(Number))];
  if (!uniqueIds.includes(Number(createdBy))) {
    uniqueIds.push(Number(createdBy));
  }

  if (uniqueIds.length < 3) {
    throw new Error('El grupo debe tener al menos 3 integrantes');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [chatResult] = await conn.execute(
      "INSERT INTO chats (type, name, created_by) VALUES ('group', ?, ?)",
      [name, createdBy]
    );

    for (const userId of uniqueIds) {
      const role = Number(userId) === Number(createdBy) ? 'admin' : 'member';
      await conn.execute(
        'INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)',
        [chatResult.insertId, userId, role]
      );
    }

    await conn.commit();
    return chatResult.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function listGroupChatsByUser(userId) {
  return query(
    `SELECT c.id AS chat_id,
            c.name AS group_name,
            c.created_at,
            COUNT(cm_all.user_id) AS members_count,
            lm.id AS last_message_id,
            lm.sender_id AS last_message_sender_id,
            sender.name AS last_message_sender_name,
            lm.content AS last_message_content,
            lm.message_type AS last_message_type,
            lm.file_name AS last_message_file_name,
            lm.created_at AS last_message_at,
            COALESCE(unread.unread_count, 0) AS unread_count
     FROM chats c
     INNER JOIN chat_members me ON me.chat_id = c.id AND me.user_id = ?
     INNER JOIN chat_members cm_all ON cm_all.chat_id = c.id
     LEFT JOIN (
       SELECT m.chat_id, MAX(m.id) AS last_message_id
       FROM messages m
       GROUP BY m.chat_id
     ) latest ON latest.chat_id = c.id
     LEFT JOIN messages lm ON lm.id = latest.last_message_id
     LEFT JOIN users sender ON sender.id = lm.sender_id
     LEFT JOIN (
       SELECT m.chat_id, COUNT(*) AS unread_count
       FROM messages m
       LEFT JOIN message_receipts mr ON mr.message_id = m.id AND mr.user_id = ?
       WHERE m.sender_id <> ?
         AND (mr.id IS NULL OR mr.read_at IS NULL)
       GROUP BY m.chat_id
     ) unread ON unread.chat_id = c.id
     WHERE c.type = 'group'
     GROUP BY c.id, c.name, c.created_at, lm.id, lm.sender_id, sender.name, lm.content, lm.message_type, lm.file_name, lm.created_at, unread.unread_count
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.created_at DESC`,
    [userId, userId, userId]
  );
}

async function getGroupChatById({ chatId, userId }) {
  const rows = await query(
    `SELECT c.id AS chat_id, c.name AS group_name, c.type
     FROM chats c
     INNER JOIN chat_members cm ON cm.chat_id = c.id
     WHERE c.id = ?
       AND c.type = 'group'
       AND cm.user_id = ?
     LIMIT 1`,
    [chatId, userId]
  );

  return rows[0] || null;
}

async function updateGroupName({ chatId, userId, name }) {
  const rows = await query(
    `SELECT c.id
     FROM chats c
     INNER JOIN chat_members cm ON cm.chat_id = c.id
     WHERE c.id = ?
       AND c.type = 'group'
       AND cm.user_id = ?
     LIMIT 1`,
    [chatId, userId]
  );

  if (!rows[0]) {
    throw new Error('No tienes acceso a este grupo');
  }

  await query('UPDATE chats SET name = ? WHERE id = ?', [name, chatId]);
  return { chatId, name };
}

async function getMessagesByChat(chatId) {
  return query(
    `SELECT m.id, m.chat_id, m.sender_id, u.name AS sender_name, m.content,
            m.message_type, m.file_name, m.file_mime, m.file_size,
            COALESCE(up.total_points, 0) AS sender_total_points,
            m.file_url,
            CASE WHEN m.file_url IS NULL THEN 0 ELSE 1 END AS has_attachment,
            CASE
              WHEN u.avatar_data IS NULL THEN NULL
              ELSE CONCAT('data:', COALESCE(u.avatar_mime, 'image/jpeg'), ';base64,', REPLACE(REPLACE(TO_BASE64(u.avatar_data), '\n', ''), '\r', ''))
            END AS sender_avatar,
            m.location_url, m.is_encrypted, m.created_at
     FROM messages m
     INNER JOIN users u ON u.id = m.sender_id
     LEFT JOIN user_points up ON up.user_id = u.id
     WHERE m.chat_id = ?
     ORDER BY m.created_at ASC`,
    [chatId]
  );
}

async function listPrivateChatsByUser(userId) {
  return query(
    `SELECT c.id AS chat_id,
            c.created_at,
            u.id AS other_user_id,
            u.name AS other_user_name,
            u.email AS other_user_email,
            u.is_online AS other_user_online,
            CASE
              WHEN u.avatar_data IS NULL THEN NULL
              ELSE CONCAT('data:', COALESCE(u.avatar_mime, 'image/jpeg'), ';base64,', REPLACE(REPLACE(TO_BASE64(u.avatar_data), '\n', ''), '\r', ''))
            END AS other_user_avatar,
          COALESCE(up.total_points, 0) AS other_user_points,
            lm.id AS last_message_id,
            lm.sender_id AS last_message_sender_id,
            sender.name AS last_message_sender_name,
            lm.content AS last_message_content,
            lm.message_type AS last_message_type,
            lm.file_name AS last_message_file_name,
            lm.created_at AS last_message_at,
            COALESCE(unread.unread_count, 0) AS unread_count
     FROM chats c
     INNER JOIN chat_members me ON me.chat_id = c.id AND me.user_id = ?
     INNER JOIN chat_members other_cm ON other_cm.chat_id = c.id AND other_cm.user_id <> ?
     INNER JOIN users u ON u.id = other_cm.user_id
     LEFT JOIN user_points up ON up.user_id = u.id
     LEFT JOIN (
       SELECT m.chat_id, MAX(m.id) AS last_message_id
       FROM messages m
       GROUP BY m.chat_id
     ) latest ON latest.chat_id = c.id
     LEFT JOIN messages lm ON lm.id = latest.last_message_id
     LEFT JOIN users sender ON sender.id = lm.sender_id
     LEFT JOIN (
       SELECT m.chat_id, COUNT(*) AS unread_count
       FROM messages m
       LEFT JOIN message_receipts mr ON mr.message_id = m.id AND mr.user_id = ?
       WHERE m.sender_id <> ?
         AND (mr.id IS NULL OR mr.read_at IS NULL)
       GROUP BY m.chat_id
     ) unread ON unread.chat_id = c.id
     WHERE c.type = 'private'
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.created_at DESC`,
    [userId, userId, userId, userId]
  );
}

async function markChatAsRead(chatId, userId) {
  const rows = await query(
    `SELECT c.id
     FROM chats c
     INNER JOIN chat_members cm ON cm.chat_id = c.id
     WHERE c.id = ?
       AND cm.user_id = ?
     LIMIT 1`,
    [chatId, userId]
  );

  if (!rows[0]) {
    throw new Error('No tienes acceso a este chat');
  }

  await query(
    `UPDATE message_receipts mr
     INNER JOIN messages m ON m.id = mr.message_id
     SET mr.read_at = COALESCE(mr.read_at, NOW()),
         mr.delivered_at = COALESCE(mr.delivered_at, NOW())
     WHERE mr.user_id = ?
       AND m.chat_id = ?
       AND m.sender_id <> ?`,
    [userId, chatId, userId]
  );

  await query(
    `INSERT IGNORE INTO message_receipts (message_id, user_id, delivered_at, read_at)
     SELECT m.id, ?, NOW(), NOW()
     FROM messages m
     WHERE m.chat_id = ?
       AND m.sender_id <> ?`,
    [userId, chatId, userId]
  );

  return { chatId, userId };
}

async function updateEncryptionStatus({ chatId, userId, enable, salt }) {
  // Verificar que el usuario sea miembro del chat
  const rows = await query(
    'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?',
    [chatId, userId]
  );

  if (!rows[0]) {
    throw new Error('No tienes permisos para modificar este chat');
  }

  try {
    // Mantener salt existente cuando no se envía uno nuevo.
    // Esto permite desencriptar historial antiguo aunque se deshabilite temporalmente.
    await query(
      'UPDATE chats SET encryption_enabled = ?, encryption_salt = COALESCE(?, encryption_salt) WHERE id = ?',
      [enable ? 1 : 0, salt, chatId]
    );
  } catch (err) {
    // Si hay error en las columnas, probablemente no existen
    console.error('Error updating encryption:', err.message);
    throw new Error('Las columnas de encriptación no existen en la BD. Ejecuta el script SQL: ALTER TABLE chats ADD COLUMN encryption_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0; ALTER TABLE chats ADD COLUMN encryption_salt VARCHAR(64) NULL;');
  }

  // Obtener estado actualizado
  const chatRows = await query(
    'SELECT encryption_enabled, encryption_salt FROM chats WHERE id = ?',
    [chatId]
  );

  return {
    chatId,
    encryptionEnabled: chatRows[0].encryption_enabled === 1,
    encryptionSalt: enable ? chatRows[0].encryption_salt : null,
  };
}

module.exports = {
  createPrivateChat,
  createGroupChat,
  getMessagesByChat,
  listPrivateChatsByUser,
  listGroupChatsByUser,
  getGroupChatById,
  updateGroupName,
  markChatAsRead,
  updateEncryptionStatus,
};
