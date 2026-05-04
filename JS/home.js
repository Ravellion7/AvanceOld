(function () {
  initNavbar('navbar-container', 'home');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const listEl = document.getElementById('friendsSidebarList');
  const pendingListEl = document.getElementById('pendingRequestsSidebarList');
  const postsFeedEl = document.getElementById('postsFeedList');
  const postComposerAvatarEl = document.getElementById('postComposerAvatar');
  const postComposerNameEl = document.getElementById('postComposerName');
  const postContentInputEl = document.getElementById('postContentInput');
  const postCharCounterEl = document.getElementById('postCharCounter');
  const postMediaInputEl = document.getElementById('postMediaInput');
  const postSelectedMediaEl = document.getElementById('postSelectedMedia');
  const btnAttachMediaEl = document.getElementById('btnAttachMedia');
  const btnCreatePostEl = document.getElementById('btnCreatePost');
  const currentUser = getCurrentUser();
  const apiBase = getApiBase();
  const socketBase = apiBase.replace(/\/api\/?$/, '');
  let friends = [];
  let selectedPostMediaFile = null;

  const MAX_POST_CHARS = 250;
  let currentPostPage = 1;
  let isLoadingMorePosts = false;
  let hasMorePosts = true;

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPostDate(value) {
    if (!value) return 'Ahora';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Ahora';

    return date.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderPostMedia(post) {
    if (!post || !post.media_url || !post.media_mime) return '';

    const mediaUrl = escapeHtml(post.media_url);
    const mediaName = escapeHtml(post.media_name || 'archivo');
    const mediaMime = String(post.media_mime || '');

    if (mediaMime.startsWith('image/')) {
      return `<img class="post-img" src="${mediaUrl}" alt="${mediaName}">`;
    }

    if (mediaMime.startsWith('video/')) {
      return `<video class="post-media-video" src="${mediaUrl}" controls></video>`;
    }

    return `<a class="msg-filelink" href="${mediaUrl}" target="_blank" rel="noopener noreferrer">Descargar ${mediaName}</a>`;
  }

  function renderPosts(rows) {
    if (!postsFeedEl) return;

    if (!rows.length) {
      postsFeedEl.innerHTML = '<div class="item small">Todavia no hay publicaciones.</div>';
      return;
    }

    postsFeedEl.innerHTML = rows
      .map((post) => {
        const avatar = post.user_avatar || '../Images/perfil.png';
        const contentHtml = post.content
          ? `<p class="post-content">${escapeHtml(post.content)}</p>`
          : '';

        return `
          <div class="item chat-item post-item">
            <div class="user-info">
              <img class="avatar" src="${avatar}" alt="Avatar de ${escapeHtml(post.user_name)}">
              <div>
                <strong>${escapeHtml(post.user_name)}</strong>
                <div class="small">${escapeHtml(formatPostDate(post.created_at))}</div>
              </div>
            </div>
            ${contentHtml}
            ${renderPostMedia(post)}
          </div>
        `;
      })
      .join('');
  }

  async function loadPosts() {
    if (!postsFeedEl) return;

    try {
      currentPostPage = 1;
      const response = await apiRequest('/posts?page=1&limit=5');
      const posts = Array.isArray(response) ? response : (response.items || []);
      hasMorePosts = response.hasMore || false;
      renderPosts(posts);
    } catch (error) {
      console.error('Error al cargar publicaciones:', error);
      postsFeedEl.innerHTML = '<div class="item small">No se pudieron cargar publicaciones.</div>';
    }
  }

  async function loadMorePosts() {
    if (!postsFeedEl || isLoadingMorePosts || !hasMorePosts) return;

    isLoadingMorePosts = true;
    currentPostPage += 1;

    try {
      const response = await apiRequest(`/posts?page=${currentPostPage}&limit=5`);
      const moreItems = response.items || (Array.isArray(response) ? response : []);

      if (moreItems && moreItems.length > 0) {
        moreItems.forEach((post) => {
          const avatar = post.user_avatar || '../Images/perfil.png';
          const contentHtml = post.content
            ? `<p class="post-content">${escapeHtml(post.content)}</p>`
            : '';

          const card = document.createElement('div');
          card.className = 'item chat-item post-item';
          card.innerHTML = `
            <div class="user-info">
              <img class="avatar" src="${avatar}" alt="Avatar de ${escapeHtml(post.user_name)}">
              <div>
                <strong>${escapeHtml(post.user_name)}</strong>
                <div class="small">${escapeHtml(formatPostDate(post.created_at))}</div>
              </div>
            </div>
            ${contentHtml}
            ${renderPostMedia(post)}
          `;

          postsFeedEl.appendChild(card);
        });
      }

      hasMorePosts = response.hasMore || false;
    } catch (error) {
      notifyError('No se pudieron cargar más publicaciones.');
    } finally {
      isLoadingMorePosts = false;
    }
  }

  function setupInfiniteScroll() {
    if (!postsFeedEl) return;

    const scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoadingMorePosts && hasMorePosts) {
            loadMorePosts();
          }
        });
      },
      { rootMargin: '200px' }
    );

    const sentinel = document.createElement('div');
    sentinel.className = 'posts-loader';
    sentinel.id = 'postsScrollSentinel';
    postsFeedEl.parentElement?.appendChild(sentinel);
    scrollObserver.observe(sentinel);
  }

  function prependPost(post) {
    if (!postsFeedEl || !post) return;

    const currentRows = postsFeedEl.querySelectorAll('.post-item').length;
    if (!currentRows) {
      renderPosts([post]);
      return;
    }

    const avatar = post.user_avatar || '../Images/perfil.png';
    const contentHtml = post.content
      ? `<p class="post-content">${escapeHtml(post.content)}</p>`
      : '';

    const card = document.createElement('div');
    card.className = 'item chat-item post-item';
    card.innerHTML = `
      <div class="user-info">
        <img class="avatar" src="${avatar}" alt="Avatar de ${escapeHtml(post.user_name)}">
        <div>
          <strong>${escapeHtml(post.user_name)}</strong>
          <div class="small">${escapeHtml(formatPostDate(post.created_at))}</div>
        </div>
      </div>
      ${contentHtml}
      ${renderPostMedia(post)}
    `;

    postsFeedEl.prepend(card);
  }

  function updateComposerCounter() {
    if (!postCharCounterEl || !postContentInputEl) return;

    const currentLength = postContentInputEl.value.length;
    postCharCounterEl.textContent = `${currentLength}/${MAX_POST_CHARS}`;
    postCharCounterEl.classList.toggle('over-limit', currentLength > MAX_POST_CHARS);
  }

  function resetComposer() {
    if (postContentInputEl) {
      postContentInputEl.value = '';
    }

    if (postMediaInputEl) {
      postMediaInputEl.value = '';
    }

    selectedPostMediaFile = null;

    if (postSelectedMediaEl) {
      postSelectedMediaEl.textContent = 'Sin archivo adjunto';
    }

    updateComposerCounter();
  }

  function wirePostComposer() {
    if (!postContentInputEl || !btnCreatePostEl || !postMediaInputEl) return;

    if (postComposerNameEl && currentUser) {
      postComposerNameEl.textContent = currentUser.name || 'Usuario';
    }

    if (postComposerAvatarEl && currentUser && currentUser.photo) {
      postComposerAvatarEl.src = currentUser.photo;
    }

    updateComposerCounter();

    postContentInputEl.addEventListener('input', () => {
      if (postContentInputEl.value.length > MAX_POST_CHARS) {
        postContentInputEl.value = postContentInputEl.value.slice(0, MAX_POST_CHARS);
      }
      updateComposerCounter();
    });

    if (btnAttachMediaEl) {
      btnAttachMediaEl.addEventListener('click', () => {
        postMediaInputEl.click();
      });
    }

    postMediaInputEl.addEventListener('change', () => {
      const file = postMediaInputEl.files && postMediaInputEl.files[0];
      if (!file) {
        selectedPostMediaFile = null;
        if (postSelectedMediaEl) {
          postSelectedMediaEl.textContent = 'Sin archivo adjunto';
        }
        return;
      }

      const mime = String(file.type || '');
      if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
        notifyWarning('Solo puedes adjuntar imagen o video.');
        postMediaInputEl.value = '';
        selectedPostMediaFile = null;
        if (postSelectedMediaEl) {
          postSelectedMediaEl.textContent = 'Sin archivo adjunto';
        }
        return;
      }

      selectedPostMediaFile = file;
      if (postSelectedMediaEl) {
        postSelectedMediaEl.textContent = `Archivo adjunto: ${file.name}`;
      }
    });

    btnCreatePostEl.addEventListener('click', async () => {
      const content = String(postContentInputEl.value || '').trim();

      if (!content && !selectedPostMediaFile) {
        notifyWarning('Escribe un texto o adjunta imagen/video para publicar.');
        return;
      }

      if (content.length > MAX_POST_CHARS) {
        notifyWarning(`Tu texto supera los ${MAX_POST_CHARS} caracteres.`);
        return;
      }

      btnCreatePostEl.disabled = true;

      try {
        let mediaBase64 = null;
        let mediaName = null;
        let mediaMime = null;
        let mediaSize = null;

        if (selectedPostMediaFile) {
          const dataUrl = await fileToDataURL(selectedPostMediaFile);
          mediaBase64 = String(dataUrl).split(',')[1] || null;
          mediaName = selectedPostMediaFile.name;
          mediaMime = selectedPostMediaFile.type || 'application/octet-stream';
          mediaSize = selectedPostMediaFile.size;
        }

        const created = await apiRequest('/posts', {
          method: 'POST',
          body: {
            content,
            mediaBase64,
            mediaName,
            mediaMime,
            mediaSize,
          },
        });

        prependPost(created);
        resetComposer();
        notifySuccess('Publicación creada.');
      } catch (error) {
        notifyError(error.message || 'No se pudo crear la publicación.');
      } finally {
        btnCreatePostEl.disabled = false;
      }
    });
  }

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
              <button class="btn-secondary btnRejectHome" data-request-id="${r.id}">Rechazar</button>
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

  wirePostComposer();
  loadPosts();
  setupInfiniteScroll();
  loadFriends();
  loadPending();
  connectStatusSocket();
})();
