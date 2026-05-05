(function () {
  initNavbar('navbar-container', 'chats');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  const chatId = Number(params.get('chatId'));
  const groupName = params.get('name') || 'Grupo';

  const titleEl = document.getElementById('chatTitle');
  const boxEl = document.getElementById('chatBox');
  const inputEl = document.getElementById('groupChatInput');
  const sendBtn = document.getElementById('btnSendGroupMessage');
  const fileInputEl = document.getElementById('groupFileInput');
  const groupNameInputEl = document.getElementById('groupNameInput');
  const renameBtn = document.getElementById('btnRenameGroup');
  const groupNameStatusEl = document.getElementById('groupNameStatus');
  const encryptionToggleEl = document.getElementById('encryptionToggle');
  const encryptionStatusEl = document.getElementById('encryptionStatus');

  const currentUser = getCurrentUser();
  const apiBase = getApiBase();
  const socketBase = apiBase.replace(/\/api\/?$/, '');
  let socket = null;
  let readTimeout = null;
  let currentGroupName = params.get('name') || 'Grupo';
  let encryptionEnabled = false;
  let encryptionSalt = null;

  if (titleEl) {
    titleEl.textContent = currentGroupName;
  }

  function updateGroupTitle(name) {
    const nextName = String(name || '').trim() || 'Grupo';
    currentGroupName = nextName;

    if (titleEl) {
      titleEl.textContent = nextName;
    }

    if (document && document.title !== undefined) {
      document.title = nextName;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('name', nextName);
    window.history.replaceState({}, '', nextUrl.toString());
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function scrollBottom() {
    boxEl.scrollTop = boxEl.scrollHeight;
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

  async function appendMessage(message) {
    const mine = currentUser && Number(message.sender_id) === Number(currentUser.id);
    const cls = mine ? 'me' : 'other';
    const isMediaAttachment = Number(message.has_attachment) === 1 && ((String(message.file_mime || '').startsWith('image/')) || (String(message.file_mime || '').startsWith('video/')));
    const isLocationMessage = String(message.message_type || '').toLowerCase() === 'location';

    // Si el mensaje está encriptado y encriptación está habilitada, desencriptar
    let displayContent = message.content;
    if (Number(message.is_encrypted) === 1 && encryptionEnabled && encryptionSalt) {
      try {
        const decrypted = await EncryptionUtils.decrypt(message.content, encryptionSalt, chatId);
        if (decrypted) {
          displayContent = decrypted;
        }
      } catch (error) {
        console.error('Error desencriptando:', error);
        displayContent = '[Mensaje encriptado]';
      }
    }

    const row = document.createElement('div');
    row.className = `message-row ${cls}`;

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
    } else if (displayContent && !isMediaAttachment) {
      const textEl = document.createElement('div');
      textEl.className = 'msg-text';
      textEl.textContent = displayContent;
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
      row.appendChild(bubble);
      row.appendChild(avatar);
    } else {
      row.appendChild(avatar);
      row.appendChild(bubble);
    }

    boxEl.appendChild(row);
    scrollBottom();
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

  async function renderHistory(rows) {
    if (!rows.length) {
      boxEl.innerHTML = '<div class="msg other"><span>No hay mensajes todavia.</span></div>';
      return;
    }

    boxEl.innerHTML = '';
    for (const m of rows) {
      await appendMessage(m);
    }
  }

  async function loadHistory() {
    if (!chatId) {
      boxEl.innerHTML = '<div class="msg other"><span>Chat grupal invalido.</span></div>';
      return;
    }

    try {
      const rows = await apiRequest(`/chats/${chatId}/messages`);
      renderHistory(rows);
      scheduleMarkAsRead();
      scrollBottom();
    } catch (_) {
      boxEl.innerHTML = '<div class="msg other"><span>No se pudo cargar historial.</span></div>';
    }
  }

  async function loadGroupInfo() {
    if (!chatId) return;

    try {
      const group = await apiRequest(`/chats/${chatId}`);
      if (group && group.group_name) {
        updateGroupTitle(group.group_name);
      }
    } catch (_) {
      updateGroupTitle(currentGroupName);
    }
  }

  async function loadEncryptionStatus() {
    if (!chatId) return;

    try {
      const response = await apiRequest(`/chats/${chatId}`);
      encryptionEnabled = Number(response.encryption_enabled) === 1;
      encryptionSalt = response.encryption_salt;
      updateEncryptionUI();
    } catch (_) {
      encryptionEnabled = false;
      encryptionSalt = null;
      updateEncryptionUI();
    }
  }

  function updateEncryptionUI() {
    if (encryptionToggleEl) {
      encryptionToggleEl.checked = encryptionEnabled;
    }
    if (encryptionStatusEl) {
      encryptionStatusEl.textContent = encryptionEnabled ? 'Encriptado' : '';
    }
  }

  function connectSocket() {
    if (!window.io || !currentUser || !chatId) return;

    const isTunnel = window.location.hostname.includes('trycloudflare.com');
    const socketTransports = isTunnel ? ['polling'] : ['websocket', 'polling'];

    socket = window.io(socketBase, {
      query: { userId: String(currentUser.id) },
      transports: socketTransports,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      socket.emit('join_chat', chatId);
    });

    socket.on('connect_error', (error) => {
      const reason = error && error.message ? error.message : 'Error de conexión';
      console.warn(`Socket.IO connection error: ${reason}`);
    });

    socket.on('receive_message', (message) => {
      if (Number(message.chat_id) !== Number(chatId)) return;

      const emptyState = boxEl.querySelector('.msg.other span');
      if (emptyState && emptyState.textContent === 'No hay mensajes todavia.') {
        boxEl.innerHTML = '';
      }

      appendMessage(message);
      if (Number(message.sender_id) !== Number(currentUser.id)) {
        scheduleMarkAsRead();
      }
    });
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || !socket || !socket.connected) return;

    let contentToSend = text;
    let isEncrypted = false;

    // Si la encriptación está habilitada, encriptar el contenido
    if (encryptionEnabled && encryptionSalt) {
      try {
        const encrypted = await EncryptionUtils.encrypt(text, encryptionSalt, chatId);
        if (encrypted) {
          contentToSend = encrypted;
          isEncrypted = true;
        }
      } catch (error) {
        notifyError('Error al encriptar mensaje.');
        return;
      }
    }

    socket.emit('send_message', {
      chatId,
      senderId: currentUser.id,
      content: contentToSend,
      messageType: 'text',
      isEncrypted,
    });

    inputEl.value = '';
  }

  async function sendFile(file) {
    if (!file || !socket || !socket.connected) return;

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
      notifyError('No se pudo enviar archivo.');
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

  const btnSendGroupLocation = document.getElementById('btnSendGroupLocation');

  async function renameGroup() {
    const name = (groupNameInputEl.value || '').trim();
    if (!name) return;

    try {
      await apiRequest(`/chats/${chatId}/name`, {
        method: 'PATCH',
        body: { name },
      });
      updateGroupTitle(name);
      if (groupNameStatusEl) groupNameStatusEl.textContent = 'Nombre de grupo actualizado.';
      groupNameInputEl.value = '';
    } catch (error) {
      if (groupNameStatusEl) {
        groupNameStatusEl.textContent = error.message || 'No se pudo actualizar el nombre.';
      }
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  if (btnSendGroupLocation) {
    btnSendGroupLocation.addEventListener('click', sendLocation);
  }

  if (encryptionToggleEl) {
    encryptionToggleEl.addEventListener('change', async () => {
      const enable = encryptionToggleEl.checked;

      try {
        const response = await apiRequest(`/chats/${chatId}/encryption`, {
          method: 'PATCH',
          body: { enable },
        });

        encryptionEnabled = response.encryptionEnabled;
        encryptionSalt = response.encryptionSalt;
        updateEncryptionUI();
        notifyWarning(enable ? 'Encriptación habilitada' : 'Encriptación deshabilitada');
      } catch (error) {
        notifyError('Error al cambiar estado de encriptación');
        encryptionToggleEl.checked = !enable; // Revertir cambio
      }
    });
  }

  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
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

  if (renameBtn) {
    renameBtn.addEventListener('click', renameGroup);
  }

  
  window.goToGroupTasks = function goToGroupTasks() {
    if (!chatId) return;
    window.location.href = `tareas.html?groupId=${encodeURIComponent(chatId)}`;
  };

  Promise.all([loadGroupInfo(), loadEncryptionStatus(), loadHistory()]).then(() => {
    connectSocket();
  });
})();

