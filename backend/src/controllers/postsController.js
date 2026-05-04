const { createPost, listPosts } = require('../models/postsModel');

const MAX_POST_LENGTH = 250;

async function getPosts(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 5)));
    const result = await listPosts(page, limit);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener publicaciones', error: error.message });
  }
}

async function createPostEntry(req, res) {
  try {
    const userId = Number(req.user.id);
    const rawContent = typeof req.body.content === 'string' ? req.body.content : '';
    const content = rawContent.trim();

    const mediaBase64 = req.body.mediaBase64 || null;
    const mediaName = req.body.mediaName || null;
    const mediaMime = req.body.mediaMime || null;
    const mediaSize = req.body.mediaSize || null;

    if (!content && !mediaBase64) {
      return res.status(400).json({ message: 'Debes escribir un texto o adjuntar un archivo.' });
    }

    if (content.length > MAX_POST_LENGTH) {
      return res.status(400).json({ message: `El texto no puede superar ${MAX_POST_LENGTH} caracteres.` });
    }

    if (mediaBase64) {
      const mime = String(mediaMime || '').toLowerCase();
      if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
        return res.status(400).json({ message: 'Solo se permite adjuntar imagen o video.' });
      }
    }

    const post = await createPost({
      userId,
      content,
      mediaBase64,
      mediaName,
      mediaMime,
      mediaSize,
    });

    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear publicación', error: error.message });
  }
}

module.exports = {
  getPosts,
  createPostEntry,
};
