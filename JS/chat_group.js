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
  let currentGroupCallType = null;
  const groupParticipantMeta = new Map();

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

    // Si el mensaje está encriptado y hay salt disponible, desencriptar
    let displayContent = message.content;
    if (Number(message.is_encrypted) === 1 && encryptionSalt) {
      try {
        const decrypted = await EncryptionUtils.decrypt(message.content, encryptionSalt, chatId);
        if (decrypted) {
          displayContent = decrypted;
        } else {
          // Decryption returned null (may be corrupted), show placeholder
          displayContent = '[Mensaje encriptado - no se pudo desencriptar]';
        }
      } catch (error) {
        console.error('Error desencriptando:', error);
        displayContent = '[Mensaje encriptado - error en desencriptación]';
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

  async function loadGroupMembers() {
    if (!chatId) return;

    try {
      const members = await apiRequest(`/chats/${chatId}/members`);
      groupParticipantMeta.clear();
      members.forEach((member) => {
        groupParticipantMeta.set(Number(member.id), {
          id: Number(member.id),
          name: member.name || `Usuario ${member.id}`,
          avatar: member.avatar || null,
          isOnline: Number(member.is_online) === 1,
          role: member.role || 'member',
        });
      });

      if (isInGroupCall || remoteStreams.size > 0) {
        renderGroupVideoGrid();
      }
    } catch (error) {
      console.warn('No se pudieron cargar los miembros del grupo:', error);
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

  function getParticipantMeta(userId) {
    const numericUserId = Number(userId);
    if (numericUserId === Number(currentUser.id)) {
      return {
        id: Number(currentUser.id),
        name: currentUser.name || 'Tú',
        avatar: currentUser.photo || currentUser.avatar || '../Images/perfil.png',
      };
    }

    return groupParticipantMeta.get(numericUserId) || {
      id: numericUserId,
      name: `Usuario ${numericUserId}`,
      avatar: '../Images/perfil.png',
    };
  }

  function createParticipantTile(meta, stream) {
    const container = document.createElement('div');
    container.className = 'group-call-tile';

    const isLocalUser = Number(meta.id) === Number(currentUser.id);
    const showVideo = currentGroupCallType === 'video' && stream && stream.getVideoTracks().length > 0;

    if (showVideo) {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isLocalUser;
      container.appendChild(video);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'group-call-placeholder';

      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'avatar-circle';

      const avatarUrl = meta.avatar || '../Images/perfil.png';
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = meta.name || 'Avatar';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '50%';
      img.onerror = () => {
        avatarWrap.innerHTML = '';
        avatarWrap.textContent = (meta.name || 'U').trim().charAt(0).toUpperCase();
      };
      avatarWrap.innerHTML = '';
      avatarWrap.appendChild(img);

      const nameLine = document.createElement('div');
      nameLine.className = 'name-line';
      nameLine.textContent = meta.name || `Usuario ${meta.id}`;

      placeholder.appendChild(avatarWrap);
      placeholder.appendChild(nameLine);
      container.appendChild(placeholder);

      // In audio calls, create a hidden audio element to play remote streams
      if (currentGroupCallType === 'audio' && !isLocalUser && stream) {
        const audio = document.createElement('audio');
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.style.display = 'none';
        container.appendChild(audio);
      }
    }

    const label = document.createElement('div');
    label.className = 'group-call-label';
    label.textContent = meta.name || `Usuario ${meta.id}`;
    container.appendChild(label);

    return container;
  }

  function connectSocket() {
    if (!window.io || !currentUser || !chatId) return;

    const isTunnel = window.location.hostname.includes('trycloudflare.com');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Use polling first on localhost to avoid WebSocket frame errors, then fallback
    const socketTransports = isTunnel ? ['polling'] : isLocalhost ? ['polling', 'websocket'] : ['websocket', 'polling'];

    socket = window.io(socketBase, {
      query: { userId: String(currentUser.id) },
      transports: socketTransports,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      socket.emit('join_chat', chatId);
      // Initialize peer for group calls
      createPeerForGroup();
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

    // Handle peer ready broadcasts in group calls
    socket.on('group:peer:ready', async (payload) => {
      if (Number(payload.chatId) !== Number(chatId)) return;
      if (Number(payload.userId) === Number(currentUser.id)) return;
      if (!isInGroupCall) return;

      try {
        const toUserId = Number(payload.userId);
        const topeerId = payload.peerId;

        // Initiate call to this peer
        if (localStream && topeerId && !peerConnections.has(toUserId)) {
          const call = peer.call(topeerId, localStream, {
            metadata: { fromUserId: currentUser.id, callType: 'audio' },
          });

          peerConnections.set(toUserId, call);

          call.on('stream', (remoteStream) => {
            remoteStreams.set(toUserId, remoteStream);
            renderGroupVideoGrid();
          });

          call.on('close', () => {
            remoteStreams.delete(toUserId);
            peerConnections.delete(toUserId);
            renderGroupVideoGrid();
          });
        }
      } catch (err) {
        console.error('Error initiating group call:', err);
      }
    });

    // Someone started a group call
    socket.on('group:call:started', async (payload) => {
      if (Number(payload.chatId) !== Number(chatId)) return;
      const isMe = Number(payload.fromUserId) === Number(currentUser.id);

      if (!isMe && !isInGroupCall) {
        const result = await Swal?.fire?.({
          title: 'Llamada grupal',
          text: `${payload.fromName || 'Usuario'} inició una ${payload.callType === 'video' ? 'videollamada' : 'llamada de audio'}.`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Participar',
          cancelButtonText: 'Rechazar',
          allowOutsideClick: false,
          allowEscapeKey: false,
        }) || { isConfirmed: confirm(`${payload.fromName} inició una llamada. ¿Participar?`) };

        if (result.isConfirmed) {
          await startGroupCall(payload.callType || 'audio', { announce: false });
        }
      }
    });

    // Someone ended a group call
    socket.on('group:call:ended', (payload) => {
      if (Number(payload.chatId) !== Number(chatId)) return;

      if (isInGroupCall) {
        endGroupCall({ announce: false });
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

  // Group call state
  let peer = null;
  let peerId = null;
  let localStream = null;
  let isInGroupCall = false;
  let isMutedGroupCall = false;
  let remoteStreams = new Map(); // userId -> { stream, connection }
  let peerConnections = new Map(); // userId -> peer.call()
  
  const groupCallContainer = document.getElementById('groupCallContainer');
  const groupVideoGrid = document.getElementById('groupVideoGrid');
  const btnGroupAudioCall = document.getElementById('btnGroupAudioCall');
  const btnGroupVideoCall = document.getElementById('btnGroupVideoCall');
  const btnEndGroupCall = document.getElementById('btnEndGroupCall');
  const btnGroupMuteToggle = document.getElementById('btnGroupMuteToggle');
  const groupCallModalTitle = document.getElementById('groupCallModalTitle');

  function createPeerForGroup() {
    if (peer) return;
    try {
      peer = new Peer(undefined, {
        host: location.hostname,
        port: location.port || (location.protocol === 'https:' ? 443 : 80),
        path: '/peerjs',
        secure: location.protocol === 'https:',
      });

      peer.on('open', (id) => {
        peerId = id;
        if (socket && socket.connected) {
          socket.emit('group:peer:ready', {
            chatId,
            userId: currentUser.id,
            peerId: id,
          });
        }
      });

      peer.on('call', async (call) => {
        try {
          const fromUserId = call.metadata?.fromUserId;
          if (!fromUserId) {
            call.close();
            return;
          }

          // Answer incoming call with local stream
          if (localStream) {
            call.answer(localStream);
            peerConnections.set(fromUserId, call);
            
            call.on('stream', (remoteStream) => {
              remoteStreams.set(fromUserId, remoteStream);
              renderGroupVideoGrid();
            });

            call.on('close', () => {
              remoteStreams.delete(fromUserId);
              peerConnections.delete(fromUserId);
              renderGroupVideoGrid();
            });
          }
        } catch (err) {
          console.error('Error answering group call:', err);
        }
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
      });
    } catch (err) {
      console.error('Peer init failed:', err);
    }
  }

  function renderGroupVideoGrid() {
    groupVideoGrid.innerHTML = '';

    // Add local stream
    if (localStream) {
      const localMeta = {
        id: Number(currentUser.id),
        name: currentUser.name || 'Tú',
        avatar: currentUser.photo || currentUser.avatar || '../Images/perfil.png',
      };
      groupVideoGrid.appendChild(createParticipantTile(localMeta, localStream));
    }

    // Add remote streams
    remoteStreams.forEach((stream, userId) => {
      const meta = getParticipantMeta(userId);
      groupVideoGrid.appendChild(createParticipantTile(meta, stream));
    });
  }

  function toggleMuteGroupCall() {
    if (!localStream) return;
    isMutedGroupCall = !isMutedGroupCall;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMutedGroupCall;
    });

    if (btnGroupMuteToggle) {
      if (isMutedGroupCall) {
        btnGroupMuteToggle.classList.add('muted');
        btnGroupMuteToggle.textContent = 'Activar micrófono';
      } else {
        btnGroupMuteToggle.classList.remove('muted');
        btnGroupMuteToggle.textContent = 'Silenciar';
      }
    }
  }

  function refreshGroupMuteButton() {
    if (!btnGroupMuteToggle) return;
    btnGroupMuteToggle.classList.remove('muted');
    btnGroupMuteToggle.textContent = 'Silenciar';
  }

  async function startGroupCall(callType, options = {}) {
    if (!peer) createPeerForGroup();
    
    try {
      const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      isInGroupCall = true;
      isMutedGroupCall = false;
      currentGroupCallType = callType === 'video' ? 'video' : 'audio';
      refreshGroupMuteButton();

      // Show UI
      if (groupCallContainer) {
        groupCallContainer.style.display = 'block';
      }
      renderGroupVideoGrid();

      // Notify other members
      if (socket && socket.connected && options.announce !== false) {
        socket.emit('group:call:start', {
          chatId,
          fromUserId: currentUser.id,
          fromName: currentUser.name || 'Usuario',
          callType: callType === 'video' ? 'video' : 'audio',
        });
      }

        // Announce the peer again now that the local stream exists and the user is in the call.
        // The first peer:ready can happen before the user joins the modal, so other members would ignore it.
        if (socket && socket.connected && peerId) {
          socket.emit('group:peer:ready', {
            chatId,
            userId: currentUser.id,
            peerId,
          });
        }

      notifyWarning(`${callType === 'video' ? 'Video' : 'Audio'}llamada grupal iniciada...`);
    } catch (err) {
      console.error('Error starting group call:', err);
      notifyError('No se pudo acceder al micrófono/cámara');
      isInGroupCall = false;
    }
  }

  async function endGroupCall(options = {}) {
    // Close all peer connections
    peerConnections.forEach((call) => {
      call.close();
    });
    peerConnections.clear();
    remoteStreams.clear();

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
      localStream = null;
    }

    isInGroupCall = false;
    isMutedGroupCall = false;
  currentGroupCallType = null;
  refreshGroupMuteButton();

    // Hide UI
    if (groupCallContainer) {
      groupCallContainer.style.display = 'none';
    }

    // Notify other members
    if (socket && socket.connected && options.announce !== false) {
      socket.emit('group:call:end', {
        chatId,
        fromUserId: currentUser.id,
        fromName: currentUser.name || 'Usuario',
      });
    }

    notifyWarning('Videollamada grupal finalizada');
  }

  // Event listeners for group call buttons
  if (btnGroupAudioCall) {
    btnGroupAudioCall.addEventListener('click', () => {
      if (isInGroupCall) {
        notifyWarning('Ya hay una llamada en progreso');
        return;
      }
      startGroupCall('audio');
    });
  }

  if (btnGroupVideoCall) {
    btnGroupVideoCall.addEventListener('click', () => {
      if (isInGroupCall) {
        notifyWarning('Ya hay una llamada en progreso');
        return;
      }
      startGroupCall('video');
    });
  }

  if (btnEndGroupCall) {
    btnEndGroupCall.addEventListener('click', endGroupCall);
  }

  if (btnGroupMuteToggle) {
    btnGroupMuteToggle.addEventListener('click', toggleMuteGroupCall);
  }

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

  (async () => {
    loadGoogleMapsScript().catch(() => null);
    await loadGroupInfo();
    await loadGroupMembers();
    await loadEncryptionStatus();
    await loadHistory();
    connectSocket();
  })();
})();

