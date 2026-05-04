const {
  createPrivateChat,
  createGroupChat,
  getMessagesByChat,
  listPrivateChatsByUser,
  listGroupChatsByUser,
  getGroupChatById,
  updateGroupName,
  markChatAsRead,
  updateEncryptionStatus,
} = require('../models/chatsModel');
const {
  awardFirstGroupCreated,
} = require('../models/achievementsModel');
const { query } = require('../config/db');

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

async function getChatInfo(req, res) {
  try {
    const userId = Number(req.user.id);
    const chatId = Number(req.params.id);

    // Verificar que el usuario es miembro del chat
    const memberRows = await query(
      'SELECT c.*, cm.role FROM chats c INNER JOIN chat_members cm ON cm.chat_id = c.id WHERE c.id = ? AND cm.user_id = ?',
      [chatId, userId]
    );

    if (!memberRows[0]) {
      return res.status(404).json({ message: 'Chat no encontrado' });
    }

    const chat = memberRows[0];
    return res.json({
      id: chat.id,
      type: chat.type,
      name: chat.name,
      group_name: chat.name,
      encryption_enabled: chat.encryption_enabled || 0,
      encryption_salt: chat.encryption_salt || null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener info del chat', error: error.message });
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

async function enableEncryption(req, res) {
  try {
    const userId = Number(req.user.id);
    const chatId = Number(req.params.id);
    const { enable } = req.body;

    if (typeof enable !== 'boolean') {
      return res.status(400).json({ message: 'enable es requerido y debe ser booleano' });
    }

    // Generar salt aleatorio (hex string de 32 caracteres)
    const salt = enable ? require('crypto').randomBytes(16).toString('hex') : null;

    const result = await updateEncryptionStatus({ chatId, userId, enable, salt });
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
  getChatInfo,
  renameGroup,
  markRead,
  enableEncryption,
};
