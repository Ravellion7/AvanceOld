const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getPosts, createPostEntry } = require('../controllers/postsController');

const router = express.Router();

router.get('/', authMiddleware, getPosts);
router.post('/', authMiddleware, createPostEntry);

module.exports = router;
