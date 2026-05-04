(function () {
  initNavbar('navbar-container', 'chats');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const friendsListEl = document.getElementById('usersList');
  const privateChatsListEl = document.getElementById('privateChatsList');
  const groupChatsListEl = document.getElementById('groupChatsList');
  const searchInputEl = document.getElementById('searchUsersInput');
  const searchBtnEl = document.getElementById('btnSearchUsers');
  const discoverInputEl = document.getElementById('discoverUsersInput');
  const discoverBtnEl = document.getElementById('btnDiscoverUsers');
  const discoverListEl = document.getElementById('discoverUsersList');
  const discoverPrevBtnEl = document.getElementById('btnDiscoverPrev');
  const discoverNextBtnEl = document.getElementById('btnDiscoverNext');
  const discoverPageInfoEl = document.getElementById('discoverPageInfo');
  const chatSearchInputEl = document.getElementById('chatSearchInput');
  const chatSearchBtnEl = document.getElementById('btnChatSearch');

  const currentUser = getCurrentUser();
  const apiBase = getApiBase();
  const socketBase = apiBase.replace(/\/api\/?$/, '');

  let allFriends = [];
  let allDiscover = [];
  let privateChats = [];
  let groupChats = [];
  let discoverTerm = '';
  let discoverPage = 1;
  let discoverTotalPages = 1;
  let chatSearchTerm = '';

  function getStatusText(isOnline) {
    return Number(isOnline) === 1 ? 'En linea' : 'Desconectado';
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatChatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getLastMessagePreview(row) {
    if (!row || !row.last_message_id) {
      return 'Todavia no hay mensajes en este chat.';
    }

    const senderPrefix = Number(row.last_message_sender_id) === Number(currentUser.id)
      ? 'Tú'
      : (row.last_message_sender_name || 'Alguien');

    let body = '';
    switch (String(row.last_message_type || 'text')) {
      case 'image':
        body = 'Imagen';
        break;
      case 'video':
        body = 'Video';
        break;
      case 'audio':
        body = 'Audio';
        break;
      case 'file':
        body = row.last_message_file_name ? `Archivo: ${row.last_message_file_name}` : 'Archivo';
        break;
      case 'location':
        body = 'Ubicación';
        break;
      case 'system':
        body = row.last_message_content || 'Mensaje del sistema';
        break;
      default:
        body = row.last_message_content || 'Mensaje';
        break;
    }

    const compactBody = body.length > 64 ? `${body.slice(0, 64)}...` : body;
    return `${senderPrefix}: ${compactBody}`;
  }

  function renderUnreadBadge(count) {
    const unread = Number(count || 0);
    if (!unread) return '';
    return `<span class="chat-unread-badge">${unread}</span>`;
  }

  function renderUserBadgeInline(points) {
    const badge = getUserBadgeMeta(points);
    const iconHtml = badge.icon
      ? `<img src="${badge.icon}" class="user-tier-icon" alt="Insignia ${escapeHtml(badge.label)}">`
      : '';

    return `
      <span class="chat-user-tier-inline">
        ${iconHtml}
        <span class="user-tier-chip ${badge.className}">${escapeHtml(badge.label)}</span>
      </span>
    `;
  }

  function renderNameWithUserBadge(name, points) {
    return `
      <div class="chat-user-name-line">
        <strong>${escapeHtml(name)}</strong>
        ${renderUserBadgeInline(points)}
      </div>
    `;
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function matchesChatSearch(row, title) {
    const term = normalizeText(chatSearchTerm.trim());
    if (!term) return true;

    const preview = getLastMessagePreview(row);
    return [title, preview, row.last_message_file_name, row.other_user_name]
      .map(normalizeText)
      .some((value) => value.includes(term));
  }

  function renderChatCard({ title, subtitle, preview, time, unreadCount, href, extraClass = '', badgePoints = 0, showBadge = true }) {
    const badge = getUserBadgeMeta(badgePoints);
    return `
      <div class="item chat-item ${extraClass} ${badge.className}">
        <div class="chat-topline">
          <div class="chat-name-wrap">
            <span class="chat-name">${escapeHtml(title)}</span>
            ${showBadge ? renderUserBadgeInline(badgePoints) : ''}
            ${renderUnreadBadge(unreadCount)}
          </div>
          <span class="chat-time">${escapeHtml(time || '')}</span>
        </div>
        <div class="chat-preview">${escapeHtml(preview)}</div>
        <div class="chat-subtitle">${escapeHtml(subtitle)}</div>
        <div class="footer-actions chat-actions">
          <a class="btn btn-ghost" href="${href}">Abrir chat</a>
        </div>
      </div>
    `;
  }

  function applyStatusToCollections(userId, isOnline) {
    allFriends = allFriends.map((f) => (Number(f.id) === Number(userId) ? { ...f, is_online: isOnline ? 1 : 0 } : f));
    allDiscover = allDiscover.map((u) => (Number(u.id) === Number(userId) ? { ...u, is_online: isOnline ? 1 : 0 } : u));
    privateChats = privateChats.map((c) =>
      Number(c.other_user_id) === Number(userId) ? { ...c, other_user_online: isOnline ? 1 : 0 } : c
    );
  }

  async function loadPrivateChats() {
    privateChats = await apiRequest('/chats/private');

    const filteredChats = privateChats.filter((row) => matchesChatSearch(row, row.other_user_name));

    if (!filteredChats.length) {
      privateChatsListEl.innerHTML = chatSearchTerm.trim()
        ? '<div class="item small">No hay chats privados que coincidan con la busqueda.</div>'
        : '<div class="item small">Todavia no tienes chats privados.</div>';
      return;
    }

    privateChatsListEl.innerHTML = filteredChats
      .map((row) => {
        const url = `chat_privado.html?chatId=${encodeURIComponent(row.chat_id)}&userId=${encodeURIComponent(row.other_user_id)}&name=${encodeURIComponent(row.other_user_name)}`;
        const preview = getLastMessagePreview(row);
        const time = formatChatTime(row.last_message_at || row.created_at);
        return renderChatCard({
          title: row.other_user_name,
          subtitle: getStatusText(row.other_user_online),
          preview,
          time,
          unreadCount: row.unread_count,
          href: url,
          badgePoints: row.other_user_points,
          showBadge: true,
        });
      })
      .join('');
  }

  async function loadGroupChats() {
    groupChats = await apiRequest('/chats/group');

    const filteredChats = groupChats.filter((row) => matchesChatSearch(row, row.group_name || 'Grupo sin nombre'));

    if (!filteredChats.length) {
      groupChatsListEl.innerHTML = chatSearchTerm.trim()
        ? '<div class="item small">No hay chats grupales que coincidan con la busqueda.</div>'
        : '<div class="item small">Todavia no tienes chats grupales.</div>';
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const createdGroupId = Number(params.get('createdGroupId') || 0);

    groupChatsListEl.innerHTML = filteredChats
      .map((row) => {
        const url = `chat_grupo.html?chatId=${encodeURIComponent(row.chat_id)}&name=${encodeURIComponent(row.group_name || 'Grupo')}`;
        const isNew = createdGroupId && Number(row.chat_id) === createdGroupId;
        const title = row.group_name || 'Grupo sin nombre';
        const preview = getLastMessagePreview(row);
        const time = formatChatTime(row.last_message_at || row.created_at);
        const subtitle = `Integrantes: ${row.members_count}${isNew ? ' · Nuevo' : ''}`;
        return renderChatCard({
          title,
          subtitle,
          preview,
          time,
          unreadCount: row.unread_count,
          href: url,
          extraClass: isNew ? 'chat-item-new' : '',
          showBadge: false,
        });
      })
      .join('');
  }

  function renderFriends(users) {
    if (!users.length) {
      friendsListEl.innerHTML = '<div class="item small">No tienes amigos aceptados todavia.</div>';
      return;
    }

    friendsListEl.innerHTML = users
      .map((u) => {
        return `
          <div class="item ${getUserBadgeMeta(u.total_points).className}">
            <div>${renderNameWithUserBadge(u.name, u.total_points)}</div>
            <div class="small">${getStatusText(u.is_online)}</div>
            <div class="footer-actions" style="margin-top:8px;">
              <button class="btnStartPrivate" data-user-id="${u.id}" data-user-name="${u.name}">Iniciar chat</button>
            </div>
          </div>
        `;
      })
      .join('');

    const startButtons = friendsListEl.querySelectorAll('.btnStartPrivate');
    startButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const userB = Number(btn.dataset.userId);
        const userName = btn.dataset.userName;

        try {
          const result = await apiRequest('/chats/private', {
            method: 'POST',
            body: { userB },
          });

          await loadPrivateChats();
          const url = `chat_privado.html?chatId=${encodeURIComponent(result.chatId)}&userId=${encodeURIComponent(userB)}&name=${encodeURIComponent(userName)}`;
          window.location.href = url;
        } catch (error) {
          notifyError(error.message || 'No se pudo crear chat privado.');
        }
      });
    });
  }

  function renderDiscover(users) {
    if (!users.length) {
      discoverListEl.innerHTML = '<div class="item small">No hay usuarios sugeridos.</div>';
      if (discoverPageInfoEl) {
        discoverPageInfoEl.textContent = `Pagina ${discoverPage} de ${discoverTotalPages}`;
      }
      return;
    }

    discoverListEl.innerHTML = users
      .map((u) => {
        const isPending = u.relation_status === 'pending';
        const pendingLabel = u.relation_direction === 'incoming'
          ? 'Solicitud pendiente de contestar'
          : 'Solicitud pendiente';

        const actionHtml = isPending
          ? `<span class="small" style="color:#a16207; font-weight:600;">${pendingLabel}</span>`
          : `<button class="btnSendRequest" data-user-id="${u.id}">Enviar solicitud</button>`;

        return `
          <div class="item ${getUserBadgeMeta(u.total_points).className}">
            <div>${renderNameWithUserBadge(u.name, u.total_points)}</div>
            <div class="small">${getStatusText(u.is_online)}</div>
            <div class="footer-actions" style="margin-top:8px;">
              ${actionHtml}
            </div>
          </div>
        `;
      })
      .join('');

    discoverListEl.querySelectorAll('.btnSendRequest').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const receiverId = Number(btn.dataset.userId);
        try {
          await apiRequest('/friends/request', {
            method: 'POST',
            body: { receiverId },
          });
          notifySuccess('Solicitud enviada.');
          await loadDiscover(discoverTerm, discoverPage);
        } catch (error) {
          notifyError(error.message || 'No se pudo enviar solicitud.');
        }
      });
    });

    if (discoverPageInfoEl) {
      discoverPageInfoEl.textContent = `Pagina ${discoverPage} de ${discoverTotalPages}`;
    }
    if (discoverPrevBtnEl) {
      discoverPrevBtnEl.disabled = discoverPage <= 1;
    }
    if (discoverNextBtnEl) {
      discoverNextBtnEl.disabled = discoverPage >= discoverTotalPages;
    }
  }

  async function loadFriends() {
    allFriends = await apiRequest('/friends');
    renderFriends(allFriends);
  }

  async function loadDiscover(term, page = 1) {
    discoverTerm = term;
    discoverPage = page;

    const params = new URLSearchParams();
    if (term) params.set('q', term);
    params.set('page', String(page));

    const response = await apiRequest(`/friends/discover?${params.toString()}`);
    allDiscover = response.items || [];
    discoverPage = Number(response.page || 1);
    discoverTotalPages = Number(response.totalPages || 1);
    renderDiscover(allDiscover);
  }

  function connectStatusSocket() {
    if (!window.io || !currentUser) return;

    const socket = window.io(socketBase, {
      query: { userId: String(currentUser.id) },
      transports: ['websocket', 'polling'],
    });

    socket.on('user_status_change', ({ userId, isOnline }) => {
      applyStatusToCollections(userId, isOnline);
      renderFriends(allFriends);
      renderDiscover(allDiscover);
      loadPrivateChats();
    });
  }

  function wireFriendSearch() {
    if (!searchBtnEl || !searchInputEl) return;

    searchBtnEl.addEventListener('click', () => {
      const term = searchInputEl.value.trim().toLowerCase();
      if (!term) {
        renderFriends(allFriends);
        return;
      }

      const filtered = allFriends.filter((u) => {
        return u.name.toLowerCase().includes(term);
      });

      renderFriends(filtered);
    });
  }

  function wireDiscoverSearch() {
    if (!discoverBtnEl || !discoverInputEl) return;

    discoverBtnEl.addEventListener('click', async () => {
      try {
        await loadDiscover(discoverInputEl.value.trim(), 1);
      } catch (error) {
        notifyError(error.message || 'No se pudo buscar usuarios.');
      }
    });
  }

  function wireChatSearch() {
    if (chatSearchBtnEl && chatSearchInputEl) {
      const runSearch = async () => {
        chatSearchTerm = chatSearchInputEl.value.trim();
        await Promise.all([loadPrivateChats(), loadGroupChats()]);
      };

      chatSearchBtnEl.addEventListener('click', runSearch);
      chatSearchInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          runSearch();
        }
      });
    }
  }

  function wireDiscoverPagination() {
    if (discoverPrevBtnEl) {
      discoverPrevBtnEl.addEventListener('click', async () => {
        if (discoverPage <= 1) return;
        await loadDiscover(discoverTerm, discoverPage - 1);
      });
    }

    if (discoverNextBtnEl) {
      discoverNextBtnEl.addEventListener('click', async () => {
        if (discoverPage >= discoverTotalPages) return;
        await loadDiscover(discoverTerm, discoverPage + 1);
      });
    }
  }

  async function init() {
    try {
      wireFriendSearch();
      wireChatSearch();
      wireDiscoverSearch();
      wireDiscoverPagination();
      await Promise.all([loadFriends(), loadPrivateChats(), loadDiscover('', 1)]);
      await loadGroupChats();
      connectStatusSocket();
    } catch (_) {
      if (friendsListEl) {
        friendsListEl.innerHTML = '<div class="item small">No se pudieron cargar amigos.</div>';
      }
      if (privateChatsListEl) {
        privateChatsListEl.innerHTML = '<div class="item small">No se pudieron cargar chats privados.</div>';
      }
      if (groupChatsListEl) {
        groupChatsListEl.innerHTML = '<div class="item small">No se pudieron cargar chats grupales.</div>';
      }
      if (discoverListEl) {
        discoverListEl.innerHTML = '<div class="item small">No se pudieron cargar sugerencias.</div>';
      }
    }
  }

  init();
})();
