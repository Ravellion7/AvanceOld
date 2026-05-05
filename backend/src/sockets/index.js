const { saveMessage, getChatMemberIds, createReceipts } = require('../models/messagesModel');
const { updateUserStatus } = require('../models/usersModel');
const {
  awardFirstPrivateMessage,
  awardFirstMultimediaMessage,
} = require('../models/achievementsModel');

// Map userId -> Set of socketIds
const userSockets = new Map();
// Map userId -> peerId
const peerMap = new Map();

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = Number(socket.handshake.query.userId || 0);

    if (userId) {
      // register socket id for this user
      const set = userSockets.get(userId) || new Set();
      set.add(socket.id);
      userSockets.set(userId, set);

      updateUserStatus(userId, true).catch(() => null);
      io.emit('user_status_change', { userId, isOnline: true });
    }

    socket.on('peer:ready', (payload) => {
      try {
        if (payload && payload.userId && payload.peerId) {
          peerMap.set(Number(payload.userId), payload.peerId);
        }
      } catch (err) {
        // ignore
      }
    });

    socket.on('join_chat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on('call:request', async (payload) => {
      try {
        const chatId = Number(payload.chatId);
        const fromUserId = Number(payload.fromUserId);
        const memberIds = await getChatMemberIds(chatId);
        const recipients = memberIds.filter((id) => Number(id) !== fromUserId);

        const notify = {
          chatId,
          fromUserId,
          fromName: payload.fromName || 'Usuario',
          fromAvatar: payload.fromAvatar || null,
          peerId: payload.peerId,
          callType: payload.callType || 'audio',
        };

        // send incoming_call to each recipient's sockets
        recipients.forEach((rid) => {
          const sockets = userSockets.get(Number(rid));
          if (sockets) {
            for (const sid of sockets) {
              io.to(sid).emit('incoming_call', notify);
            }
          }
        });
      } catch (err) {
        // silent
      }
    });

    socket.on('call:accepted', (payload) => {
      try {
        const toUserId = Number(payload.toUserId);
        const fromUserId = Number(payload.fromUserId);
        const sockets = userSockets.get(toUserId);
        const acceptorPeer = peerMap.get(fromUserId) || null;
        const info = Object.assign({}, payload, { acceptorPeerId: acceptorPeer });
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('call:accepted', info);
          }
        }
      } catch (err) {
        // ignore
      }
    });

    socket.on('call:rejected', (payload) => {
      try {
        const toUserId = Number(payload.toUserId);
        const sockets = userSockets.get(toUserId);
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('call:rejected', payload);
          }
        }
      } catch (err) {
        // ignore
      }
    });

    socket.on('call:ended', async (payload) => {
      try {
        const chatId = Number(payload.chatId);
        const fromUserId = Number(payload.fromUserId);
        const memberIds = await getChatMemberIds(chatId);
        const recipients = memberIds.filter((id) => Number(id) !== fromUserId);

        const notify = {
          chatId,
          fromUserId,
          fromName: payload.fromName || 'Usuario',
        };

        recipients.forEach((rid) => {
          const sockets = userSockets.get(Number(rid));
          if (sockets) {
            for (const sid of sockets) {
              io.to(sid).emit('call:ended', notify);
            }
          }
        });
      } catch (err) {
        // ignore
      }
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
        // remove socket id for this user
        const set = userSockets.get(userId);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(userId);
        }

        updateUserStatus(userId, false).catch(() => null);
        io.emit('user_status_change', { userId, isOnline: false });
      }
    });
  });
}

module.exports = registerSocketHandlers;
