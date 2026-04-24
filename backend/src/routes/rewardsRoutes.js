const express = require('express');
const {
	ranking,
	rewards,
	me,
	redeem,
	purchaseTheme,
	purchasePromo,
} = require('../controllers/rewardsController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/ranking', authMiddleware, ranking);
router.get('/', authMiddleware, rewards);
router.get('/me', authMiddleware, me);
router.post('/redeem/:rewardId', authMiddleware, redeem);
router.post('/purchase/theme/:themeKey', authMiddleware, purchaseTheme);
router.post('/purchase/promo/:promoKey', authMiddleware, purchasePromo);

module.exports = router;
