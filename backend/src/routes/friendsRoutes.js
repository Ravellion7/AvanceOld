const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getFriends,
  getPending,
  discover,
  requestFriend,
  acceptRequest,
  rejectRequest,
} = require('../controllers/friendsController');

const router = express.Router();

router.get('/', authMiddleware, getFriends);
router.get('/pending', authMiddleware, getPending);
router.get('/discover', authMiddleware, discover);
router.post('/request', authMiddleware, requestFriend);
router.patch('/request/:id/accept', authMiddleware, acceptRequest);
router.patch('/request/:id/reject', authMiddleware, rejectRequest);

module.exports = router;
