async function initProfilePage() {
  const photoInput = document.getElementById("profilePhotoInput");
  const photoPreview = document.getElementById("profilePhotoPreview");
  const savePhotoBtn = document.getElementById("btnSaveProfilePhoto");
  const cancelPhotoBtn = document.getElementById("btnCancelProfilePhoto");
  const photoMsg = document.getElementById("profilePhotoMsg");
  const userPostsList = document.getElementById("userPostsList");
  const noUserPosts = document.getElementById("noUserPosts");

  const u = getCurrentUser();

  // Mostrar foto de perfil actual en la previsualizacion
  if (u && u.photo) {
    photoPreview.src = u.photo;
  }

  // Previsualizacion de foto cuando se selecciona
  photoInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataURL(file);
      photoPreview.src = dataUrl;
      photoMsg.textContent = "Listo para guardar.";
      photoMsg.style.color = "#666";
    } catch (error) {
      photoMsg.textContent = "Error al leer la imagen.";
      photoMsg.style.color = "#d32f2f";
    }
  });

  // Guardar foto de perfil
  savePhotoBtn.addEventListener("click", async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
      photoMsg.textContent = "Selecciona una imagen primero.";
      photoMsg.style.color = "#d32f2f";
      return;
    }

    try {
      savePhotoBtn.disabled = true;
      photoMsg.textContent = "Guardando...";
      photoMsg.style.color = "#999";

      const dataUrl = await fileToDataURL(file);
      const value = String(dataUrl || "");
      const commaIndex = value.indexOf(",");
      if (commaIndex < 0) {
        throw new Error("No se pudo leer la imagen.");
      }

      const avatarBase64 = value.slice(commaIndex + 1);
      const avatarMime = file.type || "image/jpeg";

      const result = await apiRequest('/users/me/avatar', {
        method: 'PATCH',
        body: {
          avatarBase64,
          avatarMime,
        },
      });

      updateCurrentUser({ photo: result.photo });
      renderHeaderUser();

      photoMsg.textContent = "✓ Foto de perfil actualizada exitosamente.";
      photoMsg.style.color = "#4caf50";
      photoInput.value = "";

      setTimeout(() => {
        photoMsg.textContent = "";
      }, 3000);
    } catch (error) {
      photoMsg.textContent = error.message || "No se pudo actualizar la foto.";
      photoMsg.style.color = "#d32f2f";
    } finally {
      savePhotoBtn.disabled = false;
    }
  });

  // Cancelar selección de foto
  cancelPhotoBtn.addEventListener("click", () => {
    photoInput.value = "";
    if (u && u.photo) {
      photoPreview.src = u.photo;
    }
    photoMsg.textContent = "";
  });

  // Cargar publicaciones del usuario
  await loadUserPosts();
}

async function loadUserPosts() {
  const userPostsList = document.getElementById("userPostsList");
  const noUserPosts = document.getElementById("noUserPosts");

  try {
    const response = await apiRequest('/posts/user/my-posts?page=1&limit=50');
    const posts = Array.isArray(response) ? response : (response.items || []);

    if (posts.length === 0) {
      userPostsList.style.display = "none";
      noUserPosts.style.display = "block";
      return;
    }

    userPostsList.style.display = "block";
    noUserPosts.style.display = "none";
    userPostsList.innerHTML = "";

    posts.forEach((post) => {
      const postEl = createUserPostElement(post);
      userPostsList.appendChild(postEl);
    });
  } catch (error) {
    console.error("Error cargando publicaciones:", error);
    notifyError(error.message || "Error al cargar tus publicaciones.");
    userPostsList.style.display = "none";
    noUserPosts.innerHTML = '<p>Error al cargar tus publicaciones.</p>';
    noUserPosts.style.display = "block";
  }
}

function createUserPostElement(post) {
  const item = document.createElement("div");
  item.className = "item chat-item post-item";

  const editContent = document.createElement("div");
  editContent.className = "editContent";

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.alt = "avatar";
  if (post.user_avatar) {
    avatar.src = post.user_avatar;
  }

  const userInfo = document.createElement("div");
  const userName = document.createElement("strong");
  userName.textContent = post.user_name || "Tu publicación";
  const timeEl = document.createElement("div");
  timeEl.className = "small";
  timeEl.textContent = formatPostDate(post.created_at);

  userInfo.appendChild(userName);
  userInfo.appendChild(timeEl);
  editContent.appendChild(avatar);
  editContent.appendChild(userInfo);

  item.appendChild(editContent);

  // Contenido del post
  if (post.content) {
    const content = document.createElement("p");
    content.className = "post-content";
    content.textContent = post.content;
    item.appendChild(content);
  }

  // Media del post
  if (post.media_url) {
    const media = renderPostMedia(post);
    if (media) {
      item.appendChild(media);
    }
  }

  // Botones de acciones
  const actions = document.createElement("div");
  actions.className = "post-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn btn-ghost";
  editBtn.type = "button";
  editBtn.textContent = "Editar";
  editBtn.addEventListener("click", () => handleEditPost(post.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-secondary";
  deleteBtn.type = "button";
  deleteBtn.textContent = "Eliminar";
  deleteBtn.addEventListener("click", () => handleDeletePost(post.id, item));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  item.appendChild(actions);

  return item;
}

function renderPostMedia(post) {
  if (!post.media_url) return null;

  const mime = (post.media_mime || "").toLowerCase();

  if (mime.startsWith("image/")) {
    const img = document.createElement("img");
    img.className = "post-img";
    img.src = post.media_url;
    img.alt = post.media_name || "media";
    return img;
  } else if (mime.startsWith("video/")) {
    const video = document.createElement("video");
    video.className = "post-media-video";
    video.controls = true;
    video.src = post.media_url;
    return video;
  }

  return null;
}

function formatPostDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return diffMins === 0 ? "Hace unos momentos" : `Hace ${diffMins}m`;
  } else if (diffHours < 24) {
    return `Hace ${diffHours}h`;
  } else if (diffDays < 7) {
    return `Hace ${diffDays}d`;
  } else {
    return date.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

function handleEditPost(postId) {
  if (!postId) return;
  window.location.href = `editar_publicacion.html?id=${encodeURIComponent(postId)}`;
}

function handleDeletePost(postId, element) {
  if (!postId) return;
  window.location.href = `eliminar_publicacion.html?id=${encodeURIComponent(postId)}`;
}
