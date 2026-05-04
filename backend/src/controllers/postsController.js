const { createPost, listPosts, listUserPosts, getPostById, updatePost, deletePost } = require('../models/postsModel');

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

async function getUserPosts(req, res) {
  try {
    const userId = Number(req.user.id);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)));
    const result = await listUserPosts(userId, page, limit);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener tus publicaciones', error: error.message });
  }
}

async function getPostEntry(req, res) {
  try {
    const userId = Number(req.user.id);
    const postId = Number(req.params.postId);

    if (!postId) {
      return res.status(400).json({ message: 'ID de publicación inválido.' });
    }

    const post = await getPostById(postId, userId);
    if (!post) {
      return res.status(404).json({ message: 'No se encontró la publicación.' });
    }

    return res.json(post);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener la publicación', error: error.message });
  }
}

async function updatePostEntry(req, res) {
  try {
    const userId = Number(req.user.id);
    const postId = Number(req.params.postId);
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    const mediaBase64 = req.body.mediaBase64 || null;
    const mediaName = req.body.mediaName || null;
    const mediaMime = req.body.mediaMime || null;
    const mediaSize = req.body.mediaSize || null;
    const removeMedia = Boolean(req.body.removeMedia);

    if (!postId) {
      return res.status(400).json({ message: 'ID de publicación inválido.' });
    }

    if (!content.trim() && !mediaBase64 && !removeMedia) {
      return res.status(400).json({ message: 'Debes dejar texto o adjuntar un archivo.' });
    }

    if (!content.trim() && removeMedia && !mediaBase64) {
      return res.status(400).json({ message: 'Debes dejar texto o adjuntar un archivo.' });
    }

    const updated = await updatePost({
      postId,
      userId,
      content,
      mediaBase64,
      mediaName,
      mediaMime,
      mediaSize,
      removeMedia,
    });

    if (!updated) {
      return res.status(404).json({ message: 'No se encontró la publicación.' });
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar la publicación', error: error.message });
  }
}

async function deletePostEntry(req, res) {
  try {
    const userId = Number(req.user.id);
    const postId = Number(req.params.postId);

    if (!postId) {
      return res.status(400).json({ message: 'ID de publicación inválido.' });
    }

    const deleted = await deletePost({ postId, userId });
    if (!deleted) {
      return res.status(404).json({ message: 'No se encontró la publicación.' });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar la publicación', error: error.message });
  }
}

module.exports = {
  getPosts,
  createPostEntry,
  getUserPosts,
  getPostEntry,
  updatePostEntry,
  deletePostEntry,
};
