(function () {
  initNavbar('navbar-container', 'chats');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  const chatId = Number(params.get('chatId'));
  const otherName = params.get('name') || 'Chat privado';

  const titleEl = document.getElementById('chatTitle');
  const messagesEl = document.getElementById('chatMessages');
  const sendBtn = document.getElementById('btnSendMessage');
  const inputEl = document.getElementById('chatInput');
  const fileInputEl = document.getElementById('privateFileInput');
  const callStatusEl = document.getElementById('callStatus');
  const typingStatusEl = document.getElementById('typingStatus');
  const currentUser = getCurrentUser();
  const apiBase = getApiBase();
  const socketBase = apiBase.replace(/\/api\/?$/, '');
  let socket = null;
  let typingTimeout = null;
  let isTyping = false;
  let readTimeout = null;

  if (titleEl) {
    titleEl.textContent = `Chat con ${otherName}`;
  }

  function setStatus(text) {
    if (callStatusEl) {
      callStatusEl.textContent = text;
    }
  }

  function setTypingStatus(text) {
    if (typingStatusEl) {
      typingStatusEl.textContent = text || '';
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function formatTime(value) {
    const date = value ? new Date(value) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scheduleMarkAsRead() {
    if (!chatId) return;

    if (readTimeout) {
      clearTimeout(readTimeout);
    }

    readTimeout = setTimeout(() => {
      apiRequest(`/chats/${chatId}/read`, { method: 'POST' }).catch(() => null);
    }, 120);
  }

  function appendMessage(message) {
    const mine = currentUser && Number(message.sender_id) === Number(currentUser.id);
    const cls = mine ? 'me' : 'other';
    const isMediaAttachment = Number(message.has_attachment) === 1 && ((String(message.file_mime || '').startsWith('image/')) || (String(message.file_mime || '').startsWith('video/')));
    const isLocationMessage = String(message.message_type || '').toLowerCase() === 'location';

    const wrapper = document.createElement('div');
    wrapper.className = `message-row ${cls}`;

    const avatar = document.createElement('img');
    const senderBadge = getUserBadgeMeta(message.sender_total_points || 0);
    avatar.className = `msg-avatar ${senderBadge.className}`;
    avatar.src = message.sender_avatar || '../Images/perfil.png';
    avatar.alt = message.sender_name || 'avatar';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (isLocationMessage && message.location_url) {
      const locationEl = document.createElement('div');
      locationEl.className = 'msg-location';
      locationEl.innerHTML = `<iframe src="${escapeHtml(message.location_url)}" width="280" height="200" style="border:none;border-radius:10px;" allowfullscreen="" loading="lazy"></iframe>`;
      bubble.appendChild(locationEl);
    } else if (message.content && !isMediaAttachment) {
      const textEl = document.createElement('div');
      textEl.className = 'msg-text';
      textEl.textContent = message.content;
      bubble.appendChild(textEl);
    }

    if (Number(message.has_attachment) === 1) {
      const attachmentEl = document.createElement('div');
      attachmentEl.className = 'msg-media small';
      attachmentEl.textContent = 'Cargando archivo...';
      bubble.appendChild(attachmentEl);
      renderAttachment(message, attachmentEl);
    }

    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    footer.innerHTML = `<span class="msg-sender">${escapeHtml(message.sender_name || '')}</span><span class="msg-time">${escapeHtml(formatTime(message.created_at))}</span>`;
    bubble.appendChild(footer);

    if (mine) {
      wrapper.appendChild(bubble);
      wrapper.appendChild(avatar);
    } else {
      wrapper.appendChild(avatar);
      wrapper.appendChild(bubble);
    }

    messagesEl.appendChild(wrapper);
    scrollToBottom();
  }

  async function renderAttachment(message, targetEl) {
    try {
      targetEl.innerHTML = '';

      if (message.file_url) {
        const mime = String(message.file_mime || '');
        const url = message.file_url;

        if (mime.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = url;
          img.alt = message.file_name || 'imagen';
          targetEl.appendChild(img);
        } else if (mime.startsWith('video/')) {
          const video = document.createElement('video');
          video.src = url;
          video.controls = true;
          targetEl.appendChild(video);
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.textContent = `Descargar ${message.file_name || 'archivo'}`;
          link.download = message.file_name || 'archivo';
          link.target = '_blank';
          targetEl.appendChild(link);
        }

        return;
      }

      const response = await apiRequestRaw(`/messages/${message.id}/file`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const mime = message.file_mime || blob.type || '';

      if (mime.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = message.file_name || 'imagen';
        targetEl.appendChild(img);
      } else if (mime.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        targetEl.appendChild(video);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.textContent = `Descargar ${message.file_name || 'archivo'}`;
        link.download = message.file_name || 'archivo';
        link.target = '_blank';
        targetEl.appendChild(link);
      }
    } catch (_) {
      targetEl.textContent = 'No se pudo cargar el archivo.';
    }
  }

  function renderMessages(rows) {
    if (!rows.length) {
      messagesEl.innerHTML = '<div class="msg other"><span>No hay mensajes todavia.</span></div>';
      return;
    }

    messagesEl.innerHTML = '';
    rows.forEach((m) => appendMessage(m));
  }

  async function loadHistory() {
    if (!chatId) {
      messagesEl.innerHTML = '<div class="msg other"><span>Chat invalido.</span></div>';
      return;
    }

    try {
      const rows = await apiRequest(`/chats/${chatId}/messages`);
      renderMessages(rows);
      scheduleMarkAsRead();
      scrollToBottom();
    } catch (_) {
      messagesEl.innerHTML = '<div class="msg other"><span>No se pudo cargar historial.</span></div>';
    }
  }

  function loadSocketClientScript() {
    return new Promise((resolve, reject) => {
      if (window.io) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.8.0/socket.io.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Socket.IO client'));
      document.head.appendChild(script);
    });
  }

  async function connectSocket() {
    if (!currentUser) {
      setStatus('Estado: Sesion no disponible');
      return;
    }

    if (!chatId) {
      setStatus('Estado: Chat invalido');
      return;
    }

    try {
      await loadSocketClientScript();
    } catch (_) {
      setStatus('Estado: Socket no disponible');
      return;
    }

    if (!window.io) {
      setStatus('Estado: Socket no disponible');
      return;
    }

    socket = window.io(socketBase, {
      query: { userId: String(currentUser.id) },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setStatus('Estado: Conectado en tiempo real');
      socket.emit('join_chat', chatId);
    });

    socket.on('disconnect', () => {
      setStatus('Estado: Desconectado, reintentando...');
    });

    socket.on('receive_message', (message) => {
      if (Number(message.chat_id) !== Number(chatId)) return;

      const emptyState = messagesEl.querySelector('.msg.other span');
      if (emptyState && emptyState.textContent === 'No hay mensajes todavia.') {
        messagesEl.innerHTML = '';
      }

      appendMessage(message);
      if (Number(message.sender_id) !== Number(currentUser.id)) {
        scheduleMarkAsRead();
      }
    });

    socket.on('typing_status', (payload) => {
      if (Number(payload.chatId) !== Number(chatId)) return;
      if (Number(payload.userId) === Number(currentUser.id)) return;

      if (payload.isTyping) {
        setTypingStatus(`${payload.userName} esta escribiendo...`);
      } else {
        setTypingStatus('');
      }
    });
  }

  function emitTypingStart() {
    if (!socket || !socket.connected || isTyping) return;
    isTyping = true;
    socket.emit('typing_start', {
      chatId,
      userId: currentUser.id,
      userName: currentUser.name,
    });
  }

  function emitTypingStop() {
    if (!socket || !socket.connected || !isTyping) return;
    isTyping = false;
    socket.emit('typing_stop', {
      chatId,
      userId: currentUser.id,
      userName: currentUser.name,
    });
  }

  function sendCurrentMessage() {
    if (!socket || !socket.connected) {
      notifyWarning('No hay conexion en tiempo real en este momento.');
      return;
    }

    const text = inputEl ? inputEl.value.trim() : '';
    if (!text) return;

    socket.emit(
      'send_message',
      {
        chatId,
        senderId: currentUser.id,
        content: text,
        messageType: 'text',
      },
      (response) => {
        if (!response || !response.ok) {
          notifyError((response && response.error) || 'No se pudo enviar mensaje.');
          return;
        }
        inputEl.value = '';
        emitTypingStop();
      }
    );
  }

  async function sendFile(file) {
    if (!file) return;
    if (!socket || !socket.connected) {
      notifyWarning('No hay conexion en tiempo real en este momento.');
      return;
    }

    try {
      const dataUrl = await fileToDataURL(file);
      const base64 = String(dataUrl).split(',')[1] || '';
      const messageType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : 'file';

      socket.emit('send_message', {
        chatId,
        senderId: currentUser.id,
        content: messageType === 'file' ? file.name : null,
        messageType,
        fileBase64: base64,
        fileName: file.name,
        fileMime: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
    } catch (_) {
      notifyError('No se pudo enviar el archivo.');
    }
  }

  async function sendLocation() {
    if (!socket || !socket.connected) {
      notifyWarning('No hay conexion en tiempo real en este momento.');
      return;
    }

    if (!navigator.geolocation) {
      notifyError('Tu navegador no soporta acceso a la ubicación.');
      return;
    }

    notifyWarning('Solicitando acceso a tu ubicación...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`;

        socket.emit('send_message', {
          chatId,
          senderId: currentUser.id,
          content: `Ubicación: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          messageType: 'location',
          locationUrl,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          notifyError('Debes permitir el acceso a tu ubicación.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          notifyError('Ubicación no disponible.');
        } else {
          notifyError('No se pudo obtener la ubicación.');
        }
      }
    );
  }

  const btnLocation = document.getElementById('btnSendLocation');

  if (sendBtn) {
    sendBtn.addEventListener('click', sendCurrentMessage);
  }

  if (btnLocation) {
    btnLocation.addEventListener('click', sendLocation);
  }

  if (inputEl) {
    inputEl.addEventListener('input', () => {
      emitTypingStart();

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      typingTimeout = setTimeout(() => {
        emitTypingStop();
      }, 900);
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendCurrentMessage();
      }
    });
  }

  if (fileInputEl) {
    fileInputEl.addEventListener('change', async () => {
      const file = fileInputEl.files && fileInputEl.files[0];
      await sendFile(file);
      fileInputEl.value = '';
    });
  }

  loadHistory().then(() => {
    connectSocket();
  });
})();
