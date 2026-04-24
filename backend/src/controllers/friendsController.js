const {
  listFriends,
  listPendingRequests,
  listDiscoverUsers,
  sendFriendRequest,
  respondRequest,
} = require('../models/friendsModel');
const {
  awardFirstFriendRequestSent,
  awardFirstFriendRequestAccepted,
} = require('../models/achievementsModel');

async function getFriends(req, res) {
  try {
    const userId = Number(req.user.id);
    const rows = await listFriends(userId);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener amigos', error: error.message });
  }
}

async function getPending(req, res) {
  try {
    const userId = Number(req.user.id);
    const rows = await listPendingRequests(userId);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener solicitudes pendientes', error: error.message });
  }
}

async function discover(req, res) {
  try {
    const userId = Number(req.user.id);
    const term = (req.query.q || '').trim();
    const page = Number(req.query.page || 1);
    const pageSize = 5;
    const result = await listDiscoverUsers(userId, term, page, pageSize);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Error al buscar usuarios', error: error.message });
  }
}

async function requestFriend(req, res) {
  try {
    const requesterId = Number(req.user.id);
    const receiverId = Number(req.body.receiverId);

    if (!receiverId) {
      return res.status(400).json({ message: 'receiverId es requerido' });
    }

    const result = await sendFriendRequest(requesterId, receiverId);
    await awardFirstFriendRequestSent(requesterId).catch(() => null);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function acceptRequest(req, res) {
  try {
    const userId = Number(req.user.id);
    const requestId = Number(req.params.id);
    const result = await respondRequest({ requestId, userId, accept: true });
    await awardFirstFriendRequestAccepted(userId).catch(() => null);
    await awardFirstFriendRequestAccepted(Number(result.requesterId)).catch(() => null);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function rejectRequest(req, res) {
  try {
    const userId = Number(req.user.id);
    const requestId = Number(req.params.id);
    const result = await respondRequest({ requestId, userId, accept: false });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  getFriends,
  getPending,
  discover,
  requestFriend,
  acceptRequest,
  rejectRequest,
};
