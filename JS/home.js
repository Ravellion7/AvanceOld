(function () {
  initNavbar('navbar-container', 'home');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const listEl = document.getElementById('friendsSidebarList');
  const pendingListEl = document.getElementById('pendingRequestsSidebarList');
  const currentUser = getCurrentUser();
  const apiBase = getApiBase();
  const socketBase = apiBase.replace(/\/api\/?$/, '');
  let friends = [];

  if (!listEl) return;

  function renderFriends() {
    if (!friends.length) {
      listEl.innerHTML = '<div class="item small">Aun no tienes amigos agregados.</div>';
      return;
    }

    listEl.innerHTML = friends
      .map((u) => {
        const status = Number(u.is_online) === 1 ? 'En linea' : 'Desconectado';
        const badge = getUserBadgeMeta(u.total_points || 0);
        const iconHtml = badge.icon
          ? `<img src="${badge.icon}" class="user-tier-icon" alt="Insignia ${badge.label}">`
          : '';

        return `
          <div class="item small ${badge.className}">
            <div class="home-friend-line">
              <strong>${u.name}</strong>
              <span class="chat-user-tier-inline">
                ${iconHtml}
                <span class="user-tier-chip ${badge.className}">${badge.label}</span>
              </span>
            </div>
            <div>${status}</div>
          </div>
        `;
      })
      .join('');
  }

  async function loadFriends() {
    try {
      friends = await apiRequest('/friends');
      renderFriends();
    } catch (_) {
      listEl.innerHTML = '<div class="item small">No se pudieron cargar amigos.</div>';
    }
  }

  function renderPending(rows) {
    if (!pendingListEl) return;

    if (!rows.length) {
      pendingListEl.innerHTML = '<div class="item small">No hay solicitudes pendientes.</div>';
      return;
    }

    pendingListEl.innerHTML = rows
      .map((r) => {
        return `
          <div class="item small">
            <strong>${r.requester_name}</strong>
            <div class="footer-actions" style="margin-top:6px;">
              <button class="btnAcceptHome" data-request-id="${r.id}">Aceptar</button>
              <button class="btn-secondary" data-request-id="${r.id}">Rechazar</button>
            </div>
          </div>
        `;
      })
      .join('');

    pendingListEl.querySelectorAll('.btnAcceptHome').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const requestId = Number(btn.dataset.requestId);
        try {
          await apiRequest(`/friends/request/${requestId}/accept`, { method: 'PATCH' });
          await Promise.all([loadPending(), loadFriends()]);
        } catch (error) {
          notifyError(error.message || 'No se pudo aceptar solicitud.');
        }
      });
    });

    pendingListEl.querySelectorAll('.btnRejectHome').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const requestId = Number(btn.dataset.requestId);
        try {
          await apiRequest(`/friends/request/${requestId}/reject`, { method: 'PATCH' });
          await loadPending();
        } catch (error) {
          notifyError(error.message || 'No se pudo rechazar solicitud.');
        }
      });
    });
  }

  async function loadPending() {
    if (!pendingListEl) return;

    try {
      const rows = await apiRequest('/friends/pending');
      renderPending(rows);
    } catch (_) {
      pendingListEl.innerHTML = '<div class="item small">No se pudieron cargar solicitudes.</div>';
    }
  }

  function connectStatusSocket() {
    if (!window.io || !currentUser) return;

    const socket = window.io(socketBase, {
      query: { userId: String(currentUser.id) },
      transports: ['websocket', 'polling'],
    });

    socket.on('user_status_change', ({ userId, isOnline }) => {
      friends = friends.map((f) =>
        Number(f.id) === Number(userId) ? { ...f, is_online: isOnline ? 1 : 0 } : f
      );
      renderFriends();
    });
  }

  loadFriends();
  loadPending();
  connectStatusSocket();
})();
