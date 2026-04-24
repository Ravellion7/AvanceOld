const express = require('express');
const authMiddleware = require('../middleware/auth');
const { downloadFile } = require('../controllers/messagesController');

const router = express.Router();

router.get('/:id/file', authMiddleware, downloadFile);

module.exports = router;
