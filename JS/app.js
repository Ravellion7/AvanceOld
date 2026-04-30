
function getDefaultApiBase() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const host = window.location.hostname;
    const port = window.location.port;

    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '') {
      return `${window.location.origin}/api`;
    }

    if (port && port !== '5500' && port !== '5501') {
      return `${window.location.origin}/api`;
    }
  }

  return 'http://localhost:4000/api';
}

const API_BASE = localStorage.getItem('kickmap_api_base') || getDefaultApiBase();

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
const DEFAULT_NAVBAR_COLOR = '#CAD593';

function hexToRgb(hex) {
  const normalizedHex = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return null;
  }

  return {
    r: parseInt(normalizedHex.slice(0, 2), 16),
    g: parseInt(normalizedHex.slice(2, 4), 16),
    b: parseInt(normalizedHex.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function getPastelThemeColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return DEFAULT_THEME_COLOR;
  }

  const blendFactor = 0.62;
  return rgbToHex(
    rgb.r + ((255 - rgb.r) * blendFactor),
    rgb.g + ((255 - rgb.g) * blendFactor),
    rgb.b + ((255 - rgb.b) * blendFactor)
  );
}

function getNavbarThemeColor(theme) {
  if (!theme || theme.key === 'verde_clasico') {
    return DEFAULT_NAVBAR_COLOR;
  }

  return getPastelThemeColor(theme.color || DEFAULT_THEME_COLOR);
}

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
  document.documentElement.style.setProperty('--km-navbar-color', getNavbarThemeColor(theme));
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