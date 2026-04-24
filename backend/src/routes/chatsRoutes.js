const express = require('express');
const {
	createPrivate,
	createGroup,
	getMessages,
	listPrivate,
	listGroup,
	renameGroup,
	markRead,
} = require('../controllers/chatsController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/private', authMiddleware, listPrivate);
router.get('/group', authMiddleware, listGroup);
router.post('/private', authMiddleware, createPrivate);
router.post('/group', authMiddleware, createGroup);
router.patch('/:id/name', authMiddleware, renameGroup);
router.post('/:id/read', authMiddleware, markRead);
router.get('/:id/messages', authMiddleware, getMessages);

module.exports = router;
