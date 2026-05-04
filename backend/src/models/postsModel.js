const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { query } = require('../config/db');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const uploadsDir = path.join(projectRoot, 'Images', 'uploads');
let postsTableReady = false;

async function ensurePostsTableExists() {
  if (postsTableReady) return;

  await query(
    `CREATE TABLE IF NOT EXISTS posts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      content VARCHAR(250) NULL,
      media_url VARCHAR(2048) NULL,
      media_name VARCHAR(255) NULL,
      media_mime VARCHAR(120) NULL,
      media_size INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_posts_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      INDEX idx_posts_created (created_at),
      INDEX idx_posts_user_created (user_id, created_at)
    ) ENGINE=InnoDB`
  );

  postsTableReady = true;
}

async function storePostMedia(mediaBase64, mediaName, mediaMime, mediaSize) {
  if (!mediaBase64) {
    return {
      mediaUrl: null,
      mediaName: null,
      mediaMime: null,
      mediaSize: null,
    };
  }

  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const extension = path.extname(mediaName || '').toLowerCase();
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
  const absolutePath = path.join(uploadsDir, safeName);
  const buffer = Buffer.from(mediaBase64, 'base64');

  await fs.promises.writeFile(absolutePath, buffer);

  return {
    mediaUrl: `/Images/uploads/${safeName}`,
    mediaName: mediaName || null,
    mediaMime: mediaMime || null,
    mediaSize: Number(mediaSize || 0) || null,
  };
}

async function createPost({
  userId,
  content,
  mediaBase64 = null,
  mediaName = null,
  mediaMime = null,
  mediaSize = null,
}) {
  await ensurePostsTableExists();

  const attachment = await storePostMedia(mediaBase64, mediaName, mediaMime, mediaSize);

  const result = await query(
    `INSERT INTO posts
      (user_id, content, media_url, media_name, media_mime, media_size)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      content || null,
      attachment.mediaUrl,
      attachment.mediaName,
      attachment.mediaMime,
      attachment.mediaSize,
    ]
  );

  const rows = await query(
    `SELECT p.id,
            p.user_id,
            u.name AS user_name,
            CASE
              WHEN u.avatar_data IS NULL THEN NULL
              ELSE CONCAT('data:', COALESCE(u.avatar_mime, 'image/jpeg'), ';base64,', REPLACE(REPLACE(TO_BASE64(u.avatar_data), '\n', ''), '\r', ''))
            END AS user_avatar,
            p.content,
            p.media_url,
            p.media_name,
            p.media_mime,
            p.media_size,
            p.created_at
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return rows[0] || null;
}

async function listPosts(limit = 30) {
  await ensurePostsTableExists();

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));

  return query(
    `SELECT p.id,
            p.user_id,
            u.name AS user_name,
            CASE
              WHEN u.avatar_data IS NULL THEN NULL
              ELSE CONCAT('data:', COALESCE(u.avatar_mime, 'image/jpeg'), ';base64,', REPLACE(REPLACE(TO_BASE64(u.avatar_data), '\n', ''), '\r', ''))
            END AS user_avatar,
            p.content,
            p.media_url,
            p.media_name,
            p.media_mime,
            p.media_size,
            p.created_at
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${safeLimit}`
  );
}

module.exports = {
  createPost,
  listPosts,
};
