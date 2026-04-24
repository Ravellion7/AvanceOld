const { saveMessage, getChatMemberIds, createReceipts } = require('../models/messagesModel');
const { updateUserStatus } = require('../models/usersModel');
const {
  awardFirstPrivateMessage,
  awardFirstMultimediaMessage,
} = require('../models/achievementsModel');

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = Number(socket.handshake.query.userId || 0);

    if (userId) {
      updateUserStatus(userId, true).catch(() => null);
      io.emit('user_status_change', { userId, isOnline: true });
    }

    socket.on('join_chat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on('send_message', async (payload, callback) => {
      try {
        const message = await saveMessage({
          chatId: Number(payload.chatId),
          senderId: Number(payload.senderId),
          content: payload.content || null,
          messageType: payload.messageType || 'text',
          fileBase64: payload.fileBase64 || null,
          fileName: payload.fileName || null,
          fileMime: payload.fileMime || null,
          fileSize: payload.fileSize || null,
          locationUrl: payload.locationUrl || null,
          isEncrypted: !!payload.isEncrypted,
        });

        const memberIds = await getChatMemberIds(Number(payload.chatId));
        const recipients = memberIds.filter((id) => Number(id) !== Number(payload.senderId));
        await createReceipts(message.id, recipients);

        if (message.message_type === 'text') {
          await awardFirstPrivateMessage(Number(payload.senderId)).catch(() => null);
        }

        if (message.message_type === 'image' || message.message_type === 'video') {
          await awardFirstMultimediaMessage(Number(payload.senderId)).catch(() => null);
        }

        io.to(`chat:${payload.chatId}`).emit('receive_message', message);
        if (callback) callback({ ok: true, message });
      } catch (error) {
        if (callback) callback({ ok: false, error: error.message });
      }
    });

    socket.on('typing_start', (payload) => {
      const room = `chat:${Number(payload.chatId)}`;
      socket.to(room).emit('typing_status', {
        chatId: Number(payload.chatId),
        userId: Number(payload.userId),
        userName: payload.userName || 'Usuario',
        isTyping: true,
      });
    });

    socket.on('typing_stop', (payload) => {
      const room = `chat:${Number(payload.chatId)}`;
      socket.to(room).emit('typing_status', {
        chatId: Number(payload.chatId),
        userId: Number(payload.userId),
        userName: payload.userName || 'Usuario',
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      if (userId) {
        updateUserStatus(userId, false).catch(() => null);
        io.emit('user_status_change', { userId, isOnline: false });
      }
    });
  });
}

module.exports = registerSocketHandlers;
