
const API_BASE = localStorage.getItem('kickmap_api_base') || 'http://localhost:4000/api';

const USER_BADGE_TIERS = [
  {
    key: 'maestro',
    label: 'Maestro',
    minPoints: 500,
    icon: '../Images/master.png',
    className: 'tier-maestro',
  },
  {
    key: 'experto',
    label: 'Experto',
    minPoints: 300,
    icon: '../Images/expert.png',
    className: 'tier-experto',
  },
  {
    key: 'veterano',
    label: 'Veterano',
    minPoints: 150,
    icon: '../Images/veteran.png',
    className: 'tier-veterano',
  },
  {
    key: 'novato',
    label: 'Novato',
    minPoints: 50,
    icon: '../Images/novato.png',
    className: 'tier-novato',
  },
];

const DEFAULT_THEME_COLOR = '#0f8a3a';

function getUserBadgeMeta(points) {
  const totalPoints = Number(points || 0);
  const unlocked = USER_BADGE_TIERS.find((tier) => totalPoints >= tier.minPoints);

  if (unlocked) {
    return unlocked;
  }

  return {
    key: 'nuevo',
    label: 'Nuevo',
    minPoints: 0,
    icon: '',
    className: 'tier-nuevo',
  };
}

async function fetchCurrentUserBadgeMeta() {
  try {
    const dashboard = await apiRequest('/rewards/me');
    return getUserBadgeMeta(dashboard.total_points || 0);
  } catch (_) {
    return getUserBadgeMeta(0);
  }
}

function applyUserBadgeVisual(meta) {
  const badgeMeta = meta || getUserBadgeMeta(0);

  const userBoxEl = document.querySelector('.side-userbox');
  if (userBoxEl) {
    userBoxEl.classList.remove('tier-nuevo', 'tier-novato', 'tier-veterano', 'tier-experto', 'tier-maestro');
    userBoxEl.classList.add(badgeMeta.className);
  }

  const badgeLabelEl = document.getElementById('userBadgeLabel');
  if (badgeLabelEl) {
    badgeLabelEl.textContent = badgeMeta.label;
    badgeLabelEl.classList.remove('tier-nuevo', 'tier-novato', 'tier-veterano', 'tier-experto', 'tier-maestro');
    badgeLabelEl.classList.add(badgeMeta.className);
  }

  const badgeIconEl = document.getElementById('userBadgeIcon');
  if (badgeIconEl) {
    if (badgeMeta.icon) {
      badgeIconEl.src = badgeMeta.icon;
      badgeIconEl.alt = `Insignia ${badgeMeta.label}`;
      badgeIconEl.style.display = 'inline-block';
    } else {
      badgeIconEl.removeAttribute('src');
      badgeIconEl.style.display = 'none';
    }
  }
}

function setApiBase(url) {
  localStorage.setItem('kickmap_api_base', url);
}

function getApiBase() {
  return API_BASE;
}

function setSession(sessionData) {
  localStorage.setItem('poi_session', JSON.stringify(sessionData));
}

function getSession() {
  const raw = localStorage.getItem('poi_session');
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem('poi_session');
}

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return session.user || session;
}

function getThemeStorageKey() {
  const user = getCurrentUser();
  const userId = user ? Number(user.id || 0) : 0;
  return `kickmap_active_theme_${userId}`;
}

function getStoredProfileTheme() {
  const raw = localStorage.getItem(getThemeStorageKey());
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function setStoredProfileTheme(theme) {
  if (!theme || !theme.key || !theme.color) {
    localStorage.removeItem(getThemeStorageKey());
    return;
  }

  localStorage.setItem(getThemeStorageKey(), JSON.stringify(theme));
}

function applyProfileTheme(theme) {
  const color = theme && theme.color ? theme.color : DEFAULT_THEME_COLOR;
  document.documentElement.style.setProperty('--km-theme-color', color);
}

function updateCurrentUser(patch) {
  const session = getSession();
  if (!session || !session.user) return;

  session.user = {
    ...session.user,
    ...patch,
  };
  setSession(session);
}

function getAuthToken() {
  const session = getSession();
  return session ? session.token : null;
}

async function apiRequest(path, options = {}) {
  const method = options.method || 'GET';
  const auth = options.auth !== false;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const message = data && data.message ? data.message : 'Error de servidor';
    throw new Error(message);
  }

  return data;
}

function requireLogin() {
  if (!getSession()) {
    window.location.href = 'landing.html';
  }
}

function renderHeaderUser() {
  const user = getCurrentUser();
  const emailEl = document.getElementById('userEmail');
  if (emailEl) {
    emailEl.textContent = user ? user.name : 'Sin sesion';
  }

  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) {
    avatarEl.src = user && user.photo ? user.photo : '';
    avatarEl.style.display = user && user.photo ? 'inline-block' : 'none';
  }

  applyUserBadgeVisual(getUserBadgeMeta(0));
  fetchCurrentUserBadgeMeta().then((meta) => {
    applyUserBadgeVisual(meta);
  });
}

function wireLogoutButton() {
  const btn = document.getElementById('btnLogout');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = 'landing.html';
  });
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function apiRequestRaw(path, options = {}) {
  const method = options.method || 'GET';
  const auth = options.auth !== false;
  const headers = {
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: options.body,
  });

  if (!response.ok) {
    throw new Error('Error al consumir archivo del servidor');
  }

  return response;
}

applyProfileTheme(getStoredProfileTheme());