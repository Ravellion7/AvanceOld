const {
  createPrivateChat,
  createGroupChat,
  getMessagesByChat,
  listPrivateChatsByUser,
  listGroupChatsByUser,
  getGroupChatById,
  updateGroupName,
  markChatAsRead,
} = require('../models/chatsModel');
const {
  awardFirstGroupCreated,
} = require('../models/achievementsModel');

async function createPrivate(req, res) {
  try {
    const userA = Number(req.user.id);
    const { userB } = req.body;

    if (!userB) {
      return res.status(400).json({ message: 'userB es requerido' });
    }

    const chatId = await createPrivateChat(userA, Number(userB));
    return res.status(201).json({ chatId });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear chat privado', error: error.message });
  }
}

async function createGroup(req, res) {
  try {
    const createdBy = Number(req.user.id);
    const { name, memberIds } = req.body;

    if (!name || !Array.isArray(memberIds)) {
      return res.status(400).json({ message: 'name y memberIds son requeridos' });
    }

    const chatId = await createGroupChat({ name, createdBy, memberIds });
    await awardFirstGroupCreated(createdBy).catch(() => null);
    return res.status(201).json({ chatId });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getMessages(req, res) {
  try {
    const chatId = Number(req.params.id);
    const messages = await getMessagesByChat(chatId);
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener mensajes', error: error.message });
  }
}

async function listPrivate(req, res) {
  try {
    const userId = Number(req.user.id);
    const rows = await listPrivateChatsByUser(userId);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener chats privados', error: error.message });
  }
}

async function listGroup(req, res) {
  try {
    const userId = Number(req.user.id);
    const rows = await listGroupChatsByUser(userId);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener chats grupales', error: error.message });
  }
}

async function getGroupChat(req, res) {
  try {
    const userId = Number(req.user.id);
    const chatId = Number(req.params.id);
    const chat = await getGroupChatById({ chatId, userId });

    if (!chat) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    return res.json(chat);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener el grupo', error: error.message });
  }
}

async function renameGroup(req, res) {
  try {
    const userId = Number(req.user.id);
    const chatId = Number(req.params.id);
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'name es requerido' });
    }

    const result = await updateGroupName({ chatId, userId, name });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function markRead(req, res) {
  try {
    const userId = Number(req.user.id);
    const chatId = Number(req.params.id);

    const result = await markChatAsRead(chatId, userId);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createPrivate,
  createGroup,
  getMessages,
  listPrivate,
  listGroup,
  getGroupChat,
  renameGroup,
  markRead,
};
