const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getPosts, createPostEntry, getUserPosts, getPostEntry, updatePostEntry, deletePostEntry } = require('../controllers/postsController');

const router = express.Router();

router.get('/', authMiddleware, getPosts);
router.get('/user/my-posts', authMiddleware, getUserPosts);
router.get('/:postId', authMiddleware, getPostEntry);
router.post('/', authMiddleware, createPostEntry);
router.patch('/:postId', authMiddleware, updatePostEntry);
router.delete('/:postId', authMiddleware, deletePostEntry);

module.exports = router;
