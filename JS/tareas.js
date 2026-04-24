(function () {
  initNavbar(`navbar-container`, `tareas`);
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  const groupId = Number(params.get(`groupId`) || 0);
  const currentUser = getCurrentUser();
  
  const groupsSection = document.getElementById(`groupsSection`);
  const tasksSection = document.getElementById(`tasksSection`);
  const groupsList = document.getElementById(`groupsList`);
  const tasksList = document.getElementById(`tasksList`);
  const groupTitle = document.getElementById(`groupTitle`);
  const taskTitleInput = document.getElementById(`taskTitleInput`);
  const taskDescInput = document.getElementById(`taskDescInput`);
  const taskLocationInput = document.getElementById(`taskLocationInput`);
  const taskPointsInput = document.getElementById(`taskPointsInput`);
  const btnAddTask = document.getElementById(`btnAddTask`);
  const btnBackToChats = document.getElementById(`btnBackToChats`);

  let allGroups = [];
  let allTasks = [];

  function escapeHtml(text) {
    return String(text || ``)
      .replace(/&/g, `&amp;`)
      .replace(/</g, `&lt;`)
      .replace(/>/g, `&gt;`)
      .replace(/"/g, `&quot;`)
      .replace(/'/g, `&#039;`);
  }

  function formatDate(value) {
    if (!value) return ``;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return ``;
    return date.toLocaleDateString([], { month: `short`, day: `numeric`, hour: `2-digit`, minute: `2-digit` });
  }

  async function loadGroups() {
    try {
      allGroups = await apiRequest(`/chats/group`);
      renderGroups();
    } catch (error) {
      groupsList.innerHTML = `<div class="item small">No se pudieron cargar los grupos.</div>`;
    }
  }

  function renderGroups() {
    if (!allGroups.length) {
      groupsList.innerHTML = `<div class="item small">Todavia no tienes grupos.</div>`;
      return;
    }

    groupsList.innerHTML = allGroups
      .map((g) => {
        return `
          <div class="item chat-item">
            <div class="chat-topline">
              <strong>${escapeHtml(g.group_name || `Grupo`)}</strong>
              <span class="small">${g.members_count} integrantes</span>
            </div>
            <p class="small" style="margin:6px 0;">${g.members_count} miembros</p>
            <div class="footer-actions chat-actions">
              <a class="btn btn-ghost" href="tareas.html?groupId=${g.chat_id}">Ver tareas</a>
            </div>
          </div>
        `;
      })
      .join(``);
  }

  async function loadTasks() {
    if (!groupId) return;

    try {
      allTasks = await apiRequest(`/tasks/group/${groupId}`);
      renderTasks();
    } catch (error) {
      tasksList.innerHTML = `<div class="item small">No se pudieron cargar las tareas.</div>`;
    }
  }

  function renderTasks() {
    if (!allTasks.length) {
      tasksList.innerHTML = `<div class="item small">Todavia no hay tareas en este grupo.</div>`;
      return;
    }

    tasksList.innerHTML = allTasks
      .map((t) => {
        const isDone = t.status === `done`;
        const checkboxId = `task_${t.id}`;
        return `
          <div class="item chat-item">
            <div style="display:flex; gap:10px; align-items:center;">
              <input type="checkbox" id="${checkboxId}" class="taskCheckbox" data-task-id="${t.id}" ${isDone ? `checked` : ``}>
              <div style="flex:1;">
                <label for="${checkboxId}" style="cursor:pointer; ${isDone ? `text-decoration:line-through; opacity:0.6;` : ``}">
                  <strong>${escapeHtml(t.title)}</strong>
                </label>
                ${t.description ? `<p class="small">${escapeHtml(t.description)}</p>` : `<p class="small" style="opacity:0.6;">Sin descripción</p>`}
                ${t.location_url ? `<p class="small"><a href="${escapeHtml(t.location_url)}" target="_blank" rel="noopener noreferrer">📍 ${escapeHtml(t.location_url)}</a></p>` : ``}
                <div class="small" style="color:#666; margin-top:6px;">
                  ${t.creator_name ? `Creada por ${escapeHtml(t.creator_name)}` : ``}
                  ${t.created_at ? ` • ${formatDate(t.created_at)}` : ``}
                </div>
              </div>
              <span class="badge" style="margin:0; flex-shrink:0;">${t.points} pts</span>
            </div>
          </div>
        `;
      })
      .join(``);

    document.querySelectorAll(`.taskCheckbox`).forEach((checkbox) => {
      checkbox.addEventListener(`change`, async () => {
        const taskId = Number(checkbox.dataset.taskId);
        try {
          await apiRequest(`/tasks/${taskId}/complete`, { method: `PATCH` });
          await loadTasks();
        } catch (error) {
          alert(error.message || `No se pudo marcar la tarea como hecha.`);
        }
      });
    });
  }

  function showGroupsView() {
    groupsSection.style.display = `block`;
    tasksSection.style.display = `none`;
    btnBackToChats.style.display = `none`;
    document.getElementById(`tasksDesc`).textContent = `Selecciona un grupo para ver sus tareas.`;
  }

  function showTasksView(groupName) {
    groupsSection.style.display = `none`;
    tasksSection.style.display = `block`;
    btnBackToChats.style.display = `inline-block`;
    groupTitle.textContent = `Tareas de ${groupName}`;
  }

  if (btnAddTask) {
    btnAddTask.addEventListener(`click`, async () => {
      const title = taskTitleInput.value.trim();
      const description = taskDescInput.value.trim();
      const locationUrl = taskLocationInput.value.trim();
      const points = Number(taskPointsInput.value) || 10;

      if (!title || !groupId) {
        alert(`Ingresa un nombre para la tarea.`);
        return;
      }

      try {
        await apiRequest(`/tasks`, {
          method: `POST`,
          body: {
            chatId: groupId,
            title,
            description: description || null,
            points,
            locationUrl: locationUrl || null,
          },
        });

        taskTitleInput.value = ``;
        taskDescInput.value = ``;
        taskLocationInput.value = ``;
        taskPointsInput.value = `10`;
        await loadTasks();
      } catch (error) {
        alert(error.message || `No se pudo crear la tarea.`);
      }
    });

    taskTitleInput.addEventListener(`keydown`, (e) => {
      if (e.key === `Enter`) {
        e.preventDefault();
        btnAddTask.click();
      }
    });
  }

  async function init() {
    try {
      if (groupId) {
        const groupData = await apiRequest(`/chats/group`);
        const selectedGroup = groupData.find((g) => Number(g.chat_id) === groupId);
        if (!selectedGroup) {
          alert(`Grupo no encontrado.`);
          window.location.href = `tareas.html`;
          return;
        }
        showTasksView(selectedGroup.group_name || `Grupo`);
        await loadTasks();
      } else {
        showGroupsView();
        await loadGroups();
      }
    } catch (error) {
      console.error(error);
    }
  }

  init();
})();
