(function () {
  initNavbar('navbar-container', 'perfil');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const postId = new URLSearchParams(window.location.search).get('id');
  const btnDelete = document.getElementById('btnDelete');
  const msg = document.getElementById('msg');
  const previewAvatar = document.getElementById('previewAvatar');
  const previewName = document.getElementById('previewName');
  const previewMeta = document.getElementById('previewMeta');
  const previewText = document.getElementById('previewText');
  const previewMediaEmpty = document.getElementById('previewMediaEmpty');
  const previewImg = document.getElementById('previewImg');
  const previewVideo = document.getElementById('previewVideo');

  const currentUser = getCurrentUser();
  let postData = null;

  function setMessage(text, className) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.className = className || 'small';
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

  function showPreviewMediaEmpty(isEmpty) {
    if (previewMediaEmpty) {
      previewMediaEmpty.style.display = isEmpty ? 'block' : 'none';
    }
    if (previewImg) {
      previewImg.style.display = 'none';
      previewImg.removeAttribute('src');
    }
    if (previewVideo) {
      previewVideo.style.display = 'none';
      previewVideo.removeAttribute('src');
      previewVideo.load();
    }
  }

  function showPreviewImage(src, alt) {
    showPreviewMediaEmpty(false);
    if (previewImg) {
      previewImg.src = src;
      previewImg.alt = alt || 'Vista previa de imagen';
      previewImg.style.display = 'block';
    }
  }

  function showPreviewVideo(src) {
    showPreviewMediaEmpty(false);
    if (previewVideo) {
      previewVideo.src = src;
      previewVideo.style.display = 'block';
      previewVideo.load();
    }
  }

  function renderPreview() {
    if (!postData) return;

    if (previewName) {
      previewName.textContent = postData.user_name || currentUser?.name || 'Tu publicación';
    }

    if (previewMeta) {
      previewMeta.textContent = postData.modified_at
        ? `Editada ${formatPostDate(postData.modified_at)}`
        : `Publicada ${formatPostDate(postData.created_at)}`;
    }

    if (previewText) {
      previewText.textContent = postData.content || '';
    }

    if (postData.media_url) {
      const mime = String(postData.media_mime || '').toLowerCase();
      if (mime.startsWith('video/')) {
        showPreviewVideo(postData.media_url);
      } else {
        showPreviewImage(postData.media_url, postData.media_name || 'Vista previa');
      }
    } else {
      showPreviewMediaEmpty(true);
    }
  }

  async function loadPost() {
    if (!postId) {
      setMessage('Falta el id de la publicación.', 'small');
      if (btnDelete) btnDelete.disabled = true;
      return;
    }

    try {
      const post = await apiRequest(`/posts/${encodeURIComponent(postId)}`);
      postData = post;

      if (previewAvatar) {
        if (currentUser && currentUser.photo) {
          previewAvatar.src = currentUser.photo;
          previewAvatar.style.display = 'block';
        } else if (post.user_avatar) {
          previewAvatar.src = post.user_avatar;
          previewAvatar.style.display = 'block';
        } else {
          previewAvatar.style.display = 'none';
        }
      }

      renderPreview();
      setMessage('', 'small');
    } catch (error) {
      console.error('Error al cargar la publicación:', error);
      setMessage(error.message || 'No se pudo cargar la publicación.', 'small');
      if (btnDelete) btnDelete.disabled = true;
    }
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!postData || btnDelete.disabled) return;

      btnDelete.disabled = true;
      setMessage('Eliminando publicación...', 'small');

      try {
        await apiRequest(`/posts/${encodeURIComponent(postId)}`, {
          method: 'DELETE',
          body: {},
        });

        notifySuccess('Publicación eliminada.');
        window.setTimeout(() => {
          window.location.href = 'perfil.html';
        }, 700);
      } catch (error) {
        btnDelete.disabled = false;
        setMessage(error.message || 'No se pudo eliminar la publicación.', 'small');
        notifyError(error.message || 'No se pudo eliminar la publicación.');
      }
    });
  }

  if (currentUser && currentUser.photo && previewAvatar) {
    previewAvatar.src = currentUser.photo;
  }

  loadPost();
})();
