const express = require('express');
const { getUsers, updateMyAvatar } = require('../controllers/usersController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, getUsers);
router.patch('/me/avatar', authMiddleware, updateMyAvatar);

module.exports = router;
