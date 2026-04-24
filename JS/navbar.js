
function renderNavbar(activePage = '') {
  const isActive = (page) => activePage === page ? 'active' : '';
  
  return `
    <aside class="side-nav" aria-label="Navegacion principal">
      <div class="side-brand">KickMap</div>

      <div class="side-userbox">
        <img id="userAvatar" class="avatar" alt="avatar">
        <div>
          <div class="side-usertext">Usuario: <span id="userEmail"></span></div>
          <div class="side-user-badge-line">
            <img id="userBadgeIcon" class="user-tier-icon" alt="insignia" style="display:none;">
            <span id="userBadgeLabel" class="user-tier-chip tier-nuevo">Nuevo</span>
          </div>
        </div>
      </div>

      <nav class="side-menu">
        <a class="side-link ${isActive('home')}" href="home.html">
          <img src="../Images/inicio.png" alt="Inicio">
          <span>Inicio</span>
        </a>
        <a class="side-link ${isActive('puntos')}" href="puntos.html">
          <img src="../Images/poi.png" alt="Puntos de interes">
          <span>Puntos de interes</span>
        </a>
        <a class="side-link ${isActive('chats')}" href="chats.html">
          <img src="../Images/chats.png" alt="Chats">
          <span>Chats</span>
        </a>
        <a class="side-link ${isActive('crear_grupo')}" href="crear_grupo.html">
          <img src="../Images/creargrupo.png" alt="Crear grupo">
          <span>Crear grupo</span>
        </a>
        <a class="side-link ${isActive('tareas')}" href="tareas.html">
          <img src="../Images/tareas.png" alt="Tareas">
          <span>Tareas</span>
        </a>
        <a class="side-link ${isActive('recompensas')}" href="recompensas.html">
          <img src="../Images/recompensas.png" alt="Recompensas">
          <span>Recompensas</span>
        </a>
        <a class="side-link ${isActive('perfil')}" href="perfil.html">
          <img src="../Images/perfil.png" alt="Perfil">
          <span>Perfil</span>
        </a>
        <a class="side-link ${isActive('reglas')}" href="reglas.html">
          <img src="../Images/reglas.png" alt="Reglas">
          <span>Reglas</span>
        </a>
        <a class="side-link side-logout" href="landing.html" id="btnLogout">
          <img src="../Images/salir.png" alt="Salir">
          <span>Salir</span>
        </a>
      </nav>
    </aside>
  `;
}


function initNavbar(containerId, activePage) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = renderNavbar(activePage);
  }
}
