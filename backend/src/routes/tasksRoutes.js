const express = require(`express`);
const { create, listByGroup, complete } = require(`../controllers/tasksController`);
const authMiddleware = require(`../middleware/auth`);

const router = express.Router();

router.post(`/`, authMiddleware, create);
router.get(`/group/:groupId`, authMiddleware, listByGroup);
router.patch(`/:id/complete`, authMiddleware, complete);

module.exports = router;
