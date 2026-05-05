(function () {
  initNavbar('navbar-container', 'chats');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  const chatId = Number(params.get('chatId'));
  const otherUserId = Number(params.get('userId') || 0);
  const otherName = params.get('name') || 'Chat privado';
  let otherAvatar = params.get('avatar') || '../Images/perfil.png';

  const titleEl = document.getElementById('chatTitle');
  const messagesEl = document.getElementById('chatMessages');
  const sendBtn = document.getElementById('btnSendMessage');
  const inputEl = document.getElementById('chatInput');
  const fileInputEl = document.getElementById('privateFileInput');
  const callStatusEl = document.getElementById('callStatus');
  const typingStatusEl = document.getElementById('typingStatus');
  const encryptionToggleEl = document.getElementById('encryptionToggle');
  const encryptionStatusEl = document.getElementById('encryptionStatus');
  const currentUser = getCurrentUser();
  const apiBase = getApiBase();
  const socketBase = apiBase.replace(/\/api\/?$/, '');
  const callModalEl = document.getElementById('callModal');
  const callModalContentEl = document.getElementById('callModalContent');
  const callModalUserNameEl = document.getElementById('callModalUserName');
  const btnMuteToggleEl = document.getElementById('btnMuteToggle');
  const btnHangUpEl = document.getElementById('btnHangUp');
  let socket = null;
  let typingTimeout = null;
  let isTyping = false;
  let readTimeout = null;
  let encryptionEnabled = false;
  let encryptionSalt = null;
  // Peer/call state
  let peer = null;
  let peerId = null;
  let localStream = null;
  let currentCall = null;
  let currentCallType = null; // 'audio' or 'video'
  let isMuted = false;
  let remoteUserName = null;
  let remoteUserAvatar = null;

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

  function getUserAvatar(user) {
    if (!user) return '../Images/perfil.png';
    return user.photo || user.avatar || user.avatar_url || user.profile_picture || '../Images/perfil.png';
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

  function showCallModal(userName, userAvatar, callType) {
    remoteUserName = userName;
    remoteUserAvatar = userAvatar;
    currentCallType = callType;
    isMuted = false;

    if (callModalUserNameEl) {
      callModalUserNameEl.textContent = userName || 'Llamada en curso';
    }

    if (callModalContentEl) {
      callModalContentEl.innerHTML = '';

      if (callType === 'video' && currentCall && currentCall.peerConnection) {
        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.style.width = '100%';
        videoEl.style.borderRadius = '14px';
        callModalContentEl.appendChild(videoEl);
      } else if (userAvatar) {
        const imgEl = document.createElement('img');
        imgEl.src = userAvatar;
        imgEl.alt = userName || 'Avatar';
        callModalContentEl.appendChild(imgEl);
      } else {
        const placeholderEl = document.createElement('div');
        placeholderEl.style.width = '120px';
        placeholderEl.style.height = '120px';
        placeholderEl.style.borderRadius = '50%';
        placeholderEl.style.background = '#e0e0e0';
        placeholderEl.style.display = 'flex';
        placeholderEl.style.alignItems = 'center';
        placeholderEl.style.justifyContent = 'center';
        placeholderEl.style.fontSize = '14px';
        placeholderEl.textContent = 'Sin foto';
        callModalContentEl.appendChild(placeholderEl);
      }
    }

    if (btnMuteToggleEl) {
      btnMuteToggleEl.classList.remove('muted');
      btnMuteToggleEl.textContent = '🎤 Silenciar';
    }

    if (callModalEl) {
      callModalEl.classList.remove('hidden');
    }
  }

  function hideCallModal() {
    if (callModalEl) {
      callModalEl.classList.add('hidden');
    }
    isMuted = false;
    remoteUserName = null;
    remoteUserAvatar = null;
    currentCallType = null;
  }

  function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

    if (btnMuteToggleEl) {
      if (isMuted) {
        btnMuteToggleEl.classList.add('muted');
        btnMuteToggleEl.textContent = '🔇 Activar micrófono';
      } else {
        btnMuteToggleEl.classList.remove('muted');
        btnMuteToggleEl.textContent = '🎤 Silenciar';
      }
    }
  }

  function cleanupCallSession(showToast) {
    if (currentCall) {
      currentCall.close();
      currentCall = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
      localStream = null;
    }

    hideCallModal();
    if (showToast) {
      notifyWarning('Llamada finalizada');
    }
  }

  function endCall() {
    if (socket && socket.connected) {
      socket.emit('call:ended', {
        chatId,
        fromUserId: currentUser.id,
        fromName: currentUser.name || 'Usuario',
      });
    }
    cleanupCallSession(true);
  }

  function createPeer() {
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
          socket.emit('peer:ready', { userId: currentUser.id, peerId: id });
        }
      });

      peer.on('call', async (call) => {
        // Incoming call: answer with local stream (ask for permission if needed)
        try {
          if (!localStream) {
            const callType = call.metadata && call.metadata.callType ? call.metadata.callType : 'audio';
            const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
          }
          call.answer(localStream);
          currentCall = call;
          call.on('stream', (remoteStream) => {
            // Update modal with video stream for video calls
            if (currentCallType === 'video' && callModalContentEl) {
              callModalContentEl.innerHTML = '';
              const videoEl = document.createElement('video');
              videoEl.autoplay = true;
              videoEl.playsInline = true;
              videoEl.style.width = '100%';
              videoEl.style.borderRadius = '14px';
              videoEl.srcObject = remoteStream;
              callModalContentEl.appendChild(videoEl);
            } else {
              // For audio calls, keep the profile picture
              let remoteEl = document.getElementById('remoteVideoAuto');
              if (!remoteEl) {
                remoteEl = document.createElement('video');
                remoteEl.id = 'remoteVideoAuto';
                remoteEl.autoplay = true;
                remoteEl.playsInline = true;
                remoteEl.style.width = '280px';
                remoteEl.style.borderRadius = '8px';
                document.body.appendChild(remoteEl);
              }
              remoteEl.srcObject = remoteStream;
            }
          });

          const callType = call.metadata && call.metadata.callType ? call.metadata.callType : 'audio';
          showCallModal(otherName, otherAvatar, callType);

          call.on('close', () => {
            cleanupCallSession(false);
          });
        } catch (err) {
          console.error('Error answering call', err);
        }
      });
    } catch (err) {
      console.error('Peer init failed', err);
    }
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

  async function renderMessages(rows) {
    if (!rows.length) {
      messagesEl.innerHTML = '<div class="msg other"><span>No hay mensajes todavia.</span></div>';
      return;
    }

    messagesEl.innerHTML = '';
    for (const m of rows) {
      await appendMessage(m);
    }
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

  async function loadOtherUserAvatar() {
    if (!chatId) return;
    if (otherAvatar && otherAvatar !== '../Images/perfil.png') return;

    try {
      const rows = await apiRequest('/chats/private');
      const currentChat = Array.isArray(rows)
        ? rows.find((row) => Number(row.chat_id) === Number(chatId))
        : null;

      if (currentChat && currentChat.other_user_avatar) {
        otherAvatar = currentChat.other_user_avatar;
      }
    } catch (_) {
      // keep fallback avatar
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
      setStatus('Estado: Conectado en tiempo real');
      socket.emit('join_chat', chatId);
      // initialize peer now that socket connected
      createPeer();
    });

    socket.on('disconnect', () => {
      setStatus('Estado: Desconectado, reintentando...');
    });

    socket.on('connect_error', (error) => {
      const reason = error && error.message ? error.message : 'Error de conexión';
      setStatus(`Estado: Error de conexión en tiempo real (${reason})`);
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

    // Incoming call notification from other participant(s)
    socket.on('incoming_call', (payload) => {
      if (Number(payload.chatId) !== Number(chatId)) return;
      const showIncomingCallPrompt = async () => {
        const callerName = payload.fromName || 'Usuario';
        const callLabel = payload.callType === 'video' ? 'videollamada' : 'llamada de audio';
        if (window.Swal && Swal.fire) {
          const result = await Swal.fire({
            title: 'Llamada entrante',
            text: `${callerName} te está llamando (${callLabel}).`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Contestar',
            cancelButtonText: 'Rechazar',
            allowOutsideClick: false,
            allowEscapeKey: false,
          });
          return result.isConfirmed;
        }
        return confirm(`${callerName} te está llamando (${callLabel}). ¿Aceptar?`);
      };

      (async () => {
        const accepted = await showIncomingCallPrompt();
        if (!accepted) {
          socket.emit('call:rejected', { chatId, toUserId: payload.fromUserId, fromUserId: currentUser.id });
          return;
        }

        try {
          const constraints = payload.callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
          localStream = await navigator.mediaDevices.getUserMedia(constraints);
          const call = peer.call(payload.peerId, localStream, {
            metadata: { callType: payload.callType },
          });
          currentCall = call;
          call.on('stream', (remoteStream) => {
            // Update modal with video stream for video calls
            if (payload.callType === 'video' && callModalContentEl) {
              callModalContentEl.innerHTML = '';
              const videoEl = document.createElement('video');
              videoEl.autoplay = true;
              videoEl.playsInline = true;
              videoEl.style.width = '100%';
              videoEl.style.borderRadius = '14px';
              videoEl.srcObject = remoteStream;
              callModalContentEl.appendChild(videoEl);
            } else {
              // For audio calls, keep the profile picture
              let remoteEl = document.getElementById('remoteVideoAuto');
              if (!remoteEl) {
                remoteEl = document.createElement('video');
                remoteEl.id = 'remoteVideoAuto';
                remoteEl.autoplay = true;
                remoteEl.playsInline = true;
                remoteEl.style.width = '280px';
                remoteEl.style.borderRadius = '8px';
                document.body.appendChild(remoteEl);
              }
              remoteEl.srcObject = remoteStream;
            }
          });
          
          showCallModal(payload.fromName, payload.fromAvatar || '../Images/perfil.png', payload.callType);

          call.on('close', () => {
            cleanupCallSession(false);
          });

          socket.emit('call:accepted', { chatId, toUserId: payload.fromUserId, fromUserId: currentUser.id });
        } catch (err) {
          console.error('Error al aceptar la llamada', err);
          notifyError('No se pudo acceder al micrófono/cámara. Revisa permisos del navegador o la cámara/micrófono.');
          socket.emit('call:rejected', { chatId, toUserId: payload.fromUserId, fromUserId: currentUser.id });
        }
      })();
    });

    socket.on('call:rejected', (info) => {
      if (Number(info.chatId) !== Number(chatId)) return;
      notifyWarning('Llamada rechazada');
      cleanupCallSession(false);
    });

    socket.on('call:accepted', (info) => {
      if (Number(info.chatId) !== Number(chatId)) return;
      notifyWarning('Llamada aceptada');
    });

    socket.on('call:ended', (info) => {
      if (Number(info.chatId) !== Number(chatId)) return;
      cleanupCallSession(false);
      notifyWarning(`${info.fromName || 'El usuario'} finalizó la llamada`);
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

  async function sendCurrentMessage() {
    if (!socket || !socket.connected) {
      notifyWarning('No hay conexion en tiempo real en este momento.');
      return;
    }

    const text = inputEl ? inputEl.value.trim() : '';
    if (!text) return;

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

    socket.emit(
      'send_message',
      {
        chatId,
        senderId: currentUser.id,
        content: contentToSend,
        messageType: 'text',
        isEncrypted,
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
  const btnAudioCall = document.getElementById('btnAudioCall');
  const btnVideoCall = document.getElementById('btnVideoCall');

  async function startCall(callType) {
    if (!peer) createPeer();
    try {
      const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      // notify chat participants
      if (!socket || !socket.connected) {
        notifyError('No conectado al servidor de señalización');
        return;
      }
      socket.emit('call:request', {
        chatId,
        fromUserId: currentUser.id,
        toUserId: otherUserId,
        fromName: currentUser.name || 'Usuario',
        fromAvatar: getUserAvatar(currentUser),
        peerId,
        callType: callType === 'video' ? 'video' : 'audio',
      });

      showCallModal(otherName, otherAvatar, callType);
      notifyWarning('Llamando...');
    } catch (err) {
      notifyError('No se pudo acceder al micrófono/cámara');
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendCurrentMessage);
  }

  if (btnLocation) {
    btnLocation.addEventListener('click', sendLocation);
  }

  if (btnAudioCall) {
    btnAudioCall.addEventListener('click', () => startCall('audio'));
  }

  if (btnVideoCall) {
    btnVideoCall.addEventListener('click', () => startCall('video'));
  }

  if (btnMuteToggleEl) {
    btnMuteToggleEl.addEventListener('click', toggleMute);
  }

  if (btnHangUpEl) {
    btnHangUpEl.addEventListener('click', endCall);
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

  Promise.all([loadEncryptionStatus(), loadOtherUserAvatar(), loadHistory()]).then(() => {
    connectSocket();
  });
})();
