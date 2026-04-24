(function () {
  initNavbar('navbar-container', 'crear_grupo');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const groupNameEl = document.getElementById('groupName');
  const msgEl = document.getElementById('msgGroup');
  const createBtn = document.getElementById('btnCreate');
  const listEl = document.getElementById('groupFriendsList');

  function setMessage(text, type) {
    msgEl.textContent = text;
    msgEl.className = type || '';
  }

  function renderFriendCheckboxes(friends) {
    if (!friends.length) {
      listEl.innerHTML = '<div class="item small">No tienes amigos disponibles.</div>';
      setMessage('Necesitas tener amigos aceptados para crear un grupo.', 'notice');
      return;
    }

    listEl.innerHTML = friends
      .map(
        (friend) => `
          <div class="item friend-item-runtime">
            <input type="checkbox" class="chkUser" value="${friend.id}" id="friend_${friend.id}">
            <label class="grouplabel" for="friend_${friend.id}">${friend.name} • ${friend.email}</label>
          </div>
        `
      )
      .join('');
  }

  async function loadFriends() {
    try {
      const friends = await apiRequest('/friends');
      renderFriendCheckboxes(friends);
    } catch (error) {
      setMessage(error.message || 'No se pudieron cargar amigos.', 'notice');
    }
  }

  async function createGroup() {
    const name = (groupNameEl.value || '').trim() || 'Grupo sin nombre';
    const selected = Array.from(document.querySelectorAll('.chkUser:checked'))
      .map((x) => Number(x.value))
      .filter((id) => Number.isFinite(id));

    if (selected.length < 2) {
      setMessage('Debes seleccionar al menos 2 amigos para completar minimo 3 integrantes contando tu usuario.', 'notice');
      return;
    }

    try {
      const result = await apiRequest('/chats/group', {
        method: 'POST',
        body: {
          name,
          memberIds: selected,
        },
      });

      setMessage(`Grupo creado: ${name}`, 'ok');
      const url = `chats.html?createdGroupId=${encodeURIComponent(result.chatId)}`;
      setTimeout(() => {
        window.location.href = url;
      }, 700);
    } catch (error) {
      setMessage(error.message || 'No se pudo crear el grupo.', 'notice');
    }
  }

  createBtn.addEventListener('click', createGroup);
  loadFriends();
})();
