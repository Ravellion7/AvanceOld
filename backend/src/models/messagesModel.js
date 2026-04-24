const { query } = require('../config/db');

async function saveMessage({
  chatId,
  senderId,
  content,
  messageType = 'text',
  fileBase64 = null,
  fileName: incomingFileName = null,
  fileMime: incomingFileMime = null,
  fileSize: incomingFileSize = null,
  locationUrl = null,
  isEncrypted = false,
}) {
  let fileBuffer = null;
  let fileName = null;
  let fileMime = null;
  let fileSize = null;

  if (fileBase64) {
    fileBuffer = Buffer.from(fileBase64, 'base64');
    fileName = incomingFileName || null;
    fileMime = incomingFileMime || null;
    fileSize = Number(incomingFileSize || 0) || null;
  }

  const result = await query(
    `INSERT INTO messages
      (chat_id, sender_id, content, message_type, file_data, file_name, file_mime, file_size, location_url, is_encrypted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chatId,
      senderId,
      content,
      messageType,
      fileBuffer,
      fileName,
      fileMime,
      fileSize,
      locationUrl,
      isEncrypted ? 1 : 0,
    ]
  );

  const rows = await query(
    `SELECT m.id, m.chat_id, m.sender_id, u.name AS sender_name, m.content,
            m.message_type, m.file_name, m.file_mime, m.file_size,
            COALESCE(up.total_points, 0) AS sender_total_points,
            CASE WHEN m.file_data IS NULL THEN 0 ELSE 1 END AS has_attachment,
            CASE
              WHEN u.avatar_data IS NULL THEN NULL
              ELSE CONCAT('data:', COALESCE(u.avatar_mime, 'image/jpeg'), ';base64,', REPLACE(REPLACE(TO_BASE64(u.avatar_data), '\n', ''), '\r', ''))
            END AS sender_avatar,
            m.location_url, m.is_encrypted, m.created_at
     FROM messages m
     INNER JOIN users u ON u.id = m.sender_id
     LEFT JOIN user_points up ON up.user_id = u.id
     WHERE m.id = ?`,
    [result.insertId]
  );

  return rows[0];
}

async function getMessageFileForUser(messageId, userId) {
  const rows = await query(
    `SELECT m.id, m.file_data, m.file_name, m.file_mime
     FROM messages m
     INNER JOIN chat_members cm ON cm.chat_id = m.chat_id
     WHERE m.id = ?
       AND cm.user_id = ?
     LIMIT 1`,
    [messageId, userId]
  );

  return rows[0] || null;
}

async function getChatMemberIds(chatId) {
  const rows = await query('SELECT user_id FROM chat_members WHERE chat_id = ?', [chatId]);
  return rows.map((r) => r.user_id);
}

async function createReceipts(messageId, recipientIds) {
  for (const userId of recipientIds) {
    await query(
      'INSERT INTO message_receipts (message_id, user_id) VALUES (?, ?)',
      [messageId, userId]
    );
  }
}

module.exports = {
  saveMessage,
  getChatMemberIds,
  createReceipts,
  getMessageFileForUser,
};
