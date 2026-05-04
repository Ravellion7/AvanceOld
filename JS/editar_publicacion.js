(function () {
  initNavbar('navbar-container', 'perfil');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const postId = new URLSearchParams(window.location.search).get('id');
  const txtEdit = document.getElementById('txtEdit');
  const imgEdit = document.getElementById('imgEdit');
  const btnSave = document.getElementById('btnSave');
  const btnRemoveMedia = document.getElementById('btnRemoveMedia');
  const btnRestoreMedia = document.getElementById('btnRestoreMedia');
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
  let selectedMedia = null;
  let mediaRemoved = false;
  let selectedMediaType = null;

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

  function setPreviewMediaEmpty(isEmpty) {
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
    setPreviewMediaEmpty(false);
    if (previewImg) {
      previewImg.src = src;
      previewImg.alt = alt || 'Vista previa de imagen';
      previewImg.style.display = 'block';
    }
  }

  function showPreviewVideo(src) {
    setPreviewMediaEmpty(false);
    if (previewVideo) {
      previewVideo.src = src;
      previewVideo.style.display = 'block';
      previewVideo.load();
    }
  }

  function getActiveMedia() {
    if (selectedMedia) {
      return {
        mediaUrl: selectedMedia.dataUrl,
        mediaMime: selectedMediaType || selectedMedia.mime || '',
        mediaName: selectedMedia.name,
        isLocal: true,
      };
    }

    if (mediaRemoved || !postData || !postData.media_url) {
      return null;
    }

    return {
      mediaUrl: postData.media_url,
      mediaMime: postData.media_mime || '',
      mediaName: postData.media_name || 'archivo',
      isLocal: false,
    };
  }

  function renderPreview() {
    const content = String(txtEdit?.value || '').trim();
    if (previewText) {
      previewText.textContent = content;
    }

    if (previewName) {
      previewName.textContent = currentUser?.name || postData?.user_name || 'Tu publicación';
    }

    if (previewMeta) {
      const parts = [];
      if (postData?.modified_at) {
        parts.push(`Editando desde ${formatPostDate(postData.modified_at)}`);
      } else if (postData?.created_at) {
        parts.push(`Publicado ${formatPostDate(postData.created_at)}`);
      } else {
        parts.push('Vista previa');
      }

      if (selectedMedia) {
        parts.push('Nueva multimedia seleccionada');
      } else if (mediaRemoved) {
        parts.push('Multimedia removida');
      }

      previewMeta.textContent = parts.join(' · ');
    }

    const activeMedia = getActiveMedia();
    if (!activeMedia) {
      setPreviewMediaEmpty(true);
    } else if ((activeMedia.mediaMime || '').toLowerCase().startsWith('video/')) {
      showPreviewVideo(activeMedia.mediaUrl);
    } else {
      showPreviewImage(activeMedia.mediaUrl, activeMedia.mediaName);
    }

    if (btnRemoveMedia) {
      btnRemoveMedia.disabled = !postData || (!postData.media_url && !selectedMedia);
      btnRemoveMedia.textContent = selectedMedia ? 'Quitar archivo seleccionado' : 'Quitar imagen/video';
    }

    if (btnRestoreMedia) {
      btnRestoreMedia.disabled = !postData || (!postData.media_url && !selectedMedia);
    }
  }

  async function loadPost() {
    if (!postId) {
      setMessage('Falta el id de la publicación.', 'small');
      if (btnSave) btnSave.disabled = true;
      if (btnRemoveMedia) btnRemoveMedia.disabled = true;
      if (btnRestoreMedia) btnRestoreMedia.disabled = true;
      if (txtEdit) txtEdit.disabled = true;
      if (imgEdit) imgEdit.disabled = true;
      return;
    }

    try {
      const post = await apiRequest(`/posts/${encodeURIComponent(postId)}`);
      postData = post;

      if (txtEdit) {
        txtEdit.value = post.content || '';
      }

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
      if (btnSave) btnSave.disabled = true;
    }
  }

  if (txtEdit) {
    txtEdit.addEventListener('input', () => {
      renderPreview();
    });
  }

  if (imgEdit) {
    imgEdit.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        selectedMedia = null;
        selectedMediaType = null;
        renderPreview();
        return;
      }

      const mime = String(file.type || '').toLowerCase();
      if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
        notifyWarning('Solo puedes adjuntar una imagen o un video.');
        imgEdit.value = '';
        selectedMedia = null;
        selectedMediaType = null;
        renderPreview();
        return;
      }

      try {
        const dataUrl = await fileToDataURL(file);
        selectedMedia = {
          file,
          dataUrl,
          mime,
          name: file.name,
        };
        selectedMediaType = mime;
        mediaRemoved = false;
        renderPreview();
        setMessage('Multimedia nueva lista para guardarse.', 'ok');
      } catch (error) {
        notifyError('No se pudo leer el archivo seleccionado.');
      }
    });
  }

  if (btnRemoveMedia) {
    btnRemoveMedia.addEventListener('click', () => {
      if (selectedMedia) {
        selectedMedia = null;
        selectedMediaType = null;
        if (imgEdit) {
          imgEdit.value = '';
        }
        setMessage('Se quitó el archivo seleccionado.', 'ok');
      } else if (postData?.media_url) {
        mediaRemoved = true;
        setMessage('La multimedia original se quitará al guardar.', 'ok');
      }

      renderPreview();
    });
  }

  if (btnRestoreMedia) {
    btnRestoreMedia.addEventListener('click', () => {
      mediaRemoved = false;
      selectedMedia = null;
      selectedMediaType = null;
      if (imgEdit) {
        imgEdit.value = '';
      }
      setMessage('Se restauró la multimedia original.', 'ok');
      renderPreview();
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      if (!postData || btnSave.disabled) return;

      const content = String(txtEdit?.value || '').trim();
      const activeMedia = getActiveMedia();

      if (!content && !activeMedia) {
        notifyWarning('Debes dejar texto o multimedia en la publicación.');
        return;
      }

      btnSave.disabled = true;
      setMessage('Guardando cambios...', 'small');

      try {
        const body = {
          content,
          removeMedia: Boolean(mediaRemoved && !selectedMedia),
        };

        if (selectedMedia) {
          const base64 = String(selectedMedia.dataUrl || '').split(',')[1] || null;
          body.mediaBase64 = base64;
          body.mediaName = selectedMedia.name;
          body.mediaMime = selectedMedia.mime;
          body.mediaSize = selectedMedia.file.size;
          body.removeMedia = false;
        }

        await apiRequest(`/posts/${encodeURIComponent(postId)}`, {
          method: 'PATCH',
          body,
        });

        notifySuccess('Publicación actualizada.');
        window.setTimeout(() => {
          window.location.href = 'perfil.html';
        }, 700);
      } catch (error) {
        btnSave.disabled = false;
        setMessage(error.message || 'No se pudieron guardar los cambios.', 'small');
        notifyError(error.message || 'No se pudieron guardar los cambios.');
      }
    });
  }

  if (currentUser && currentUser.photo && previewAvatar) {
    previewAvatar.src = currentUser.photo;
  }

  if (previewText) {
    previewText.textContent = txtEdit ? txtEdit.value : '';
  }

  loadPost();
})();
