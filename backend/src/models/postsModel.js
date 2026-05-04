const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { query } = require('../config/db');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const uploadsDir = path.join(projectRoot, 'Images', 'uploads');
let postsTableReady = false;

function buildPostSelectFields() {
  return `p.id,
            p.user_id,
            u.name AS user_name,
            CASE
              WHEN u.avatar_data IS NULL THEN NULL
              ELSE CONCAT('data:', COALESCE(u.avatar_mime, 'image/jpeg'), ';base64,', REPLACE(REPLACE(TO_BASE64(u.avatar_data), '\n', ''), '\r', ''))
            END AS user_avatar,
            p.content,
            p.media_url,
            p.media_name,
            COALESCE(
              p.media_mime,
              CASE
                WHEN LOWER(COALESCE(p.media_url, '')) REGEXP '\\.(mp4|m4v|mov|webm|ogv)$' THEN 'video/mp4'
                WHEN LOWER(COALESCE(p.media_url, '')) REGEXP '\\.(jpg|jpeg|png|gif|webp|bmp|svg)$' THEN 'image/jpeg'
                ELSE NULL
              END
            ) AS media_mime,
            p.media_size,
            p.created_at,
            p.modified_at,
            p.deleted_at`;
}

function getStoredMediaAbsolutePath(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return null;
  }

  if (!mediaUrl.startsWith('/Images/uploads/')) {
    return null;
  }

  return path.join(projectRoot, mediaUrl.replace(/^\//, ''));
}

async function removeStoredMediaFile(mediaUrl) {
  const absolutePath = getStoredMediaAbsolutePath(mediaUrl);
  if (!absolutePath) return;

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function hasPostsColumn(columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'posts'
       AND COLUMN_NAME = ?`,
    [columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function hasPostsIndex(indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'posts'
       AND INDEX_NAME = ?`,
    [indexName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

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
      modified_at TIMESTAMP NULL,
      deleted_at TIMESTAMP NULL,
      CONSTRAINT fk_posts_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      INDEX idx_posts_created (created_at),
      INDEX idx_posts_user_created (user_id, created_at),
      INDEX idx_posts_deleted (deleted_at)
    ) ENGINE=InnoDB`
  );

  if (!(await hasPostsColumn('modified_at'))) {
    await query('ALTER TABLE posts ADD COLUMN modified_at TIMESTAMP NULL');
  }

  if (!(await hasPostsColumn('deleted_at'))) {
    await query('ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP NULL');
  }

  if (!(await hasPostsIndex('idx_posts_deleted'))) {
    await query('ALTER TABLE posts ADD INDEX idx_posts_deleted (deleted_at)');
  }

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
    `SELECT ${buildPostSelectFields()}
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.id = ?
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [result.insertId]
  );

  return rows[0] || null;
}

async function listPosts(page = 1, limit = 5) {
  await ensurePostsTableExists();

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 5));
  const offset = (safePage - 1) * safeLimit;

  const rows = await query(
    `SELECT ${buildPostSelectFields()}
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.deleted_at IS NULL
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${safeLimit} OFFSET ${offset}`
  );

  const countResult = await query('SELECT COUNT(*) AS total FROM posts WHERE deleted_at IS NULL');
  const total = Number(countResult[0]?.total || 0);

  return {
    items: rows,
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: offset + safeLimit < total,
  };
}

async function listUserPosts(userId, page = 1, limit = 10) {
  await ensurePostsTableExists();

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
  const offset = (safePage - 1) * safeLimit;

  const rows = await query(
    `SELECT ${buildPostSelectFields()}
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ${Number(userId)} AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${safeLimit} OFFSET ${offset}`
  );

  const countResult = await query(`SELECT COUNT(*) AS total FROM posts WHERE user_id = ${Number(userId)} AND deleted_at IS NULL`);
  const total = Number(countResult[0]?.total || 0);

  return {
    items: rows,
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: offset + safeLimit < total,
  };
}

async function getPostById(postId, userId) {
  await ensurePostsTableExists();

  const rows = await query(
    `SELECT ${buildPostSelectFields()}
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.id = ?
       AND p.user_id = ?
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [Number(postId), Number(userId)]
  );

  return rows[0] || null;
}

async function updatePost({ postId, userId, content, mediaBase64 = null, mediaName = null, mediaMime = null, mediaSize = null, removeMedia = false }) {
  await ensurePostsTableExists();

  const existingRows = await query(
    `SELECT id, media_url, media_name, media_mime, media_size
     FROM posts
     WHERE id = ?
       AND user_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [Number(postId), Number(userId)]
  );

  const existing = existingRows[0] || null;
  if (!existing) {
    return null;
  }

  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const hasNewMedia = Boolean(mediaBase64);

  if (!normalizedContent && !hasNewMedia && !removeMedia && !existing.media_url) {
    throw new Error('Debes dejar texto o adjuntar un archivo.');
  }

  let nextMedia = {
    mediaUrl: existing.media_url,
    mediaName: existing.media_name,
    mediaMime: existing.media_mime,
    mediaSize: existing.media_size,
  };

  if (removeMedia) {
    await removeStoredMediaFile(existing.media_url);
    nextMedia = {
      mediaUrl: null,
      mediaName: null,
      mediaMime: null,
      mediaSize: null,
    };
  }

  if (hasNewMedia) {
    if (existing.media_url && existing.media_url !== nextMedia.mediaUrl) {
      await removeStoredMediaFile(existing.media_url);
    }

    nextMedia = await storePostMedia(mediaBase64, mediaName, mediaMime, mediaSize);
  }

  await query(
    `UPDATE posts
        SET content = ?,
            media_url = ?,
            media_name = ?,
            media_mime = ?,
            media_size = ?,
            modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL`,
    [
      normalizedContent || null,
      nextMedia.mediaUrl,
      nextMedia.mediaName,
      nextMedia.mediaMime,
      nextMedia.mediaSize,
      Number(postId),
      Number(userId),
    ]
  );

  return getPostById(postId, userId);
}

async function deletePost({ postId, userId }) {
  await ensurePostsTableExists();

  const existingRows = await query(
    `SELECT id, media_url
     FROM posts
     WHERE id = ?
       AND user_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [Number(postId), Number(userId)]
  );

  const existing = existingRows[0] || null;
  if (!existing) {
    return null;
  }

  await removeStoredMediaFile(existing.media_url);

  await query(
    `UPDATE posts
        SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL`,
    [Number(postId), Number(userId)]
  );

  return true;
}

module.exports = {
  createPost,
  listPosts,
  listUserPosts,
  getPostById,
  updatePost,
  deletePost,
};
