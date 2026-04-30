(function () {
  initNavbar('navbar-container', 'recompensas');
  requireLogin();
  renderHeaderUser();
  wireLogoutButton();

  const BADGES = [
    { id: 1, name: 'Novato', icon: '../Images/novato.png', requiredPoints: 50, description: 'Obtén 50 puntos' },
    { id: 2, name: 'Veterano', icon: '../Images/veteran.png', requiredPoints: 150, description: 'Obtén 150 puntos' },
    { id: 3, name: 'Experto', icon: '../Images/expert.png', requiredPoints: 300, description: 'Obtén 300 puntos' },
    { id: 4, name: 'Maestro', icon: '../Images/master.png', requiredPoints: 500, description: 'Obtén 500 puntos' },
  ];

  const ACHIEVEMENTS = [
    { key: 'first_friend_request_sent', title: 'Amigos?', description: 'Envía tu primer solicitud de amigo a alguien', value: 3 },
    { key: 'first_friend_request_accepted', title: 'Amigos!', description: 'Acepta tu primer solicitud de amistad, o haz que alguien acepte tu solicitud de amistad', value: 3 },
    { key: 'first_private_message', title: 'Primer Contacto!', description: 'Envía tu primer mensaje privado a un amigo', value: 3 },
    { key: 'first_group_created', title: 'Líder', description: 'Crea un chat grupal por primera vez', value: 3 },
    { key: 'first_multimedia_message', title: 'Multimedia', description: 'Envía una foto o video a un chat privado o grupal por primera vez', value: 3 },
    { key: 'first_task_created', title: 'Hay tarea?', description: 'Agrega tu primer tarea en un chat grupal', value: 3 },
    { key: 'first_task_completed', title: 'Responsable', description: 'Realiza tu primer tarea grupal', value: 3 },
    { key: 'first_avatar_change', title: 'Cambio de look', description: 'Cambia tu foto de perfil por una nueva', value: 3 },
  ];

  const DEFAULT_THEME_KEY = 'verde_clasico';

  const THEMES = [
    { key: 'verde_clasico', name: 'Verde Clásico', color: '#0f8a3a', requiredPoints: 0, description: 'Tema estándar de la plataforma' },
    { key: 'naranja_suave', name: 'Naranja Suave', color: '#F5A955', requiredPoints: 100, description: 'Tema cálido y suave de la plataforma' },
    { key: 'azul_premium', name: 'Azul Premium', color: '#1e40af', requiredPoints: 150, description: 'Tema azul elegante' },
    { key: 'purpura_oscuro', name: 'Púrpura Oscuro', color: '#6d28d9', requiredPoints: 200, description: 'Tema oscuro y sofisticado' },
  ];

  const PROMOS = [
    { key: 'promo_10', name: 'Cupón Descuento 10%', requiredPoints: 75, description: 'Descuento del 10% en tiendas asociadas' },
    { key: 'promo_20', name: 'Cupón Descuento 20%', requiredPoints: 150, description: 'Descuento del 20% en tiendas asociadas' },
    { key: 'premium_7d', name: 'Código Premium +7d', requiredPoints: 250, description: 'Acceso premium por 7 días' },
  ];

  let userPoints = 0;
  let unlockedAchievementKeys = [];
  let purchasedThemeKeys = new Set();
  let purchasedPromosByKey = new Map();
  let appliedThemeKey = null;
  let isProcessingPurchase = false;

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updatePointsUI() {
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) {
      pointsEl.textContent = String(userPoints);
    }
  }

  function setUserPoints(value) {
    userPoints = Number(value || 0);
    updatePointsUI();
  }

  function syncAppliedThemeFromStorage() {
    const storedTheme = getStoredProfileTheme();
    if (!storedTheme || !storedTheme.key || !purchasedThemeKeys.has(storedTheme.key)) {
      const defaultTheme = THEMES.find((theme) => theme.key === DEFAULT_THEME_KEY);
      appliedThemeKey = defaultTheme ? defaultTheme.key : null;
      if (defaultTheme) {
        applyProfileTheme(defaultTheme);
      }
      return;
    }

    appliedThemeKey = storedTheme.key;
    applyProfileTheme(storedTheme);
  }

  async function loadDashboard() {
    try {
      const dashboard = await apiRequest('/rewards/me');
      setUserPoints(dashboard.total_points || 0);
      unlockedAchievementKeys = dashboard.unlocked_achievement_keys || [];
      purchasedThemeKeys = new Set(dashboard.purchased_theme_keys || []);
      purchasedPromosByKey = new Map(
        (dashboard.purchased_promos || []).map((promo) => [promo.key, promo])
      );
      syncAppliedThemeFromStorage();
    } catch (error) {
      console.error('Error cargando recompensas:', error);
      setUserPoints(0);
      unlockedAchievementKeys = [];
      purchasedThemeKeys = new Set();
      purchasedPromosByKey = new Map();
      appliedThemeKey = null;
    }
  }

  function isUnlocked(requiredPoints) {
    return userPoints >= requiredPoints;
  }

  function renderBadges() {
    const badgesList = document.getElementById('badgesList');
    badgesList.innerHTML = BADGES
      .map((badge) => {
        const unlocked = isUnlocked(badge.requiredPoints);
        return `
          <div class="item chat-item" style="opacity:${unlocked ? '1' : '0.6'};">
            <div class="badge-section">
              <span class="badge" style="padding:6px 10px;">
                <img src="${unlocked ? badge.icon : '../Images/lock.png'}" alt="${unlocked ? `Insignia ${escapeHtml(badge.name)}` : 'Bloqueado'}" style="width:18px; height:18px; object-fit:contain;">
              </span>
              <strong>${escapeHtml(badge.name)}</strong>
            </div>
            <p class="small">${escapeHtml(badge.description)}</p>
            <p class="small" style="color:#0f8a3a; font-weight:600; margin-top:6px;">
              ${unlocked ? 'Desbloqueado' : `Falta: ${badge.requiredPoints - userPoints} pts`}
            </p>
          </div>
        `;
      })
      .join('');
  }

  function renderAchievements() {
    const achievementsList = document.getElementById('achievementsList');
    if (!achievementsList) return;

    achievementsList.innerHTML = ACHIEVEMENTS
      .map((achievement) => {
        const unlocked = unlockedAchievementKeys.includes(achievement.key);
        return `
          <div class="item chat-item" style="opacity:${unlocked ? '1' : '0.6'};">
            <div class="badge-section">
              <span class="badge" style="padding:6px 10px;">
                <img src="${unlocked ? '../Images/unlocked.png' : '../Images/lock.png'}" alt="Logro" style="width:18px; height:18px; object-fit:contain;">
              </span>
              <strong>${escapeHtml(achievement.title)}</strong>
            </div>
            <p class="small">${escapeHtml(achievement.description)}</p>
            <p class="small" style="color:#0f8a3a; font-weight:600; margin-top:6px;">
              ${unlocked ? 'Completado!' : 'Bloqueado'} · Valor: ${achievement.value} puntos
            </p>
          </div>
        `;
      })
      .join('');
  }

  function renderThemes() {
    const themesList = document.getElementById('themesList');
    themesList.innerHTML = THEMES
      .map((theme) => {
        const owned = theme.requiredPoints === 0 || purchasedThemeKeys.has(theme.key);
        const canBuy = userPoints >= theme.requiredPoints;
        const isApplied = owned && appliedThemeKey === theme.key;

        let actionHtml = '';
        if (owned) {
          actionHtml = `<button class="btn ${isApplied ? 'btn-ghost' : ''}" data-theme-apply="${theme.key}" ${isApplied ? 'disabled' : ''}>${isApplied ? 'Aplicado' : 'Aplicar'}</button>`;
        } else if (canBuy) {
          actionHtml = `<button class="btn" data-theme-buy="${theme.key}">Comprar por ${theme.requiredPoints}</button>`;
        }

        return `
          <div class="item chat-item" style="opacity:1;">
            <div style="display:flex; gap:12px; align-items:center;">
              <div style="width:40px; height:40px; background:${theme.color}; border-radius:8px; flex-shrink:0;"></div>
              <div style="flex:1;">
                <strong>${escapeHtml(theme.name)}</strong>
                <p class="small">${escapeHtml(theme.description)}</p>
                <p class="small" style="color:#0f8a3a; font-weight:600; margin-top:4px;">
                  ${owned ? 'Comprado' : (canBuy ? 'Disponible para compra' : `Te faltan ${theme.requiredPoints - userPoints} puntos`)}
                </p>
                ${actionHtml ? `<div class="footer-actions" style="margin-top:8px;">${actionHtml}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderPromos() {
    const promosList = document.getElementById('promosList');
    promosList.innerHTML = PROMOS
      .map((promo) => {
        const purchasedPromo = purchasedPromosByKey.get(promo.key);
        const owned = Boolean(purchasedPromo);
        const canBuy = userPoints >= promo.requiredPoints;

        let buySection = '';
        if (owned) {
          buySection = `
            <div style="background:#f0f9f4; border:1px solid #c8f5d8; border-radius:8px; padding:10px; margin-top:8px;">
              <p class="small" style="color:#666; margin:0 0 4px;">Tu código:</p>
              <p style="font-weight:bold; color:#0f8a3a; margin:0; font-family:monospace;">${escapeHtml(purchasedPromo.code)}</p>
            </div>
          `;
        } else if (canBuy) {
          buySection = `
            <div class="footer-actions" style="margin-top:8px;">
              <button class="btn" data-promo-buy="${promo.key}">Comprar por ${promo.requiredPoints}</button>
            </div>
          `;
        } else {
          buySection = `<p class="small" style="color:#c62828; font-weight:600; margin-top:6px;">Te faltan ${promo.requiredPoints - userPoints} puntos</p>`;
        }

        return `
          <div class="item chat-item" style="opacity:1;">
            <div style="display:flex; gap:12px; align-items:flex-start;">
              <div style="flex-shrink:0; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">
                <img src="../Images/discount.png" alt="Promoción" style="width:22px; height:22px; object-fit:contain;">
              </div>
              <div style="flex:1;">
                <strong>${escapeHtml(promo.name)}</strong>
                <p class="small">${escapeHtml(promo.description)}</p>
                ${buySection}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function rerenderAll() {
    renderBadges();
    renderAchievements();
    renderThemes();
    renderPromos();
  }

  async function buyTheme(themeKey) {
    if (isProcessingPurchase) return;
    isProcessingPurchase = true;
    try {
      const result = await apiRequest(`/rewards/purchase/theme/${encodeURIComponent(themeKey)}`, {
        method: 'POST',
      });
      purchasedThemeKeys.add(themeKey);
      setUserPoints(result.total_points || userPoints);
      rerenderAll();
    } catch (error) {
      alert(error.message || 'No se pudo comprar el tema.');
    } finally {
      isProcessingPurchase = false;
    }
  }

  function applyTheme(themeKey) {
    const theme = THEMES.find((item) => item.key === themeKey);
    if (!theme || (theme.requiredPoints > 0 && !purchasedThemeKeys.has(themeKey))) return;

    appliedThemeKey = themeKey;
    const payload = {
      key: theme.key,
      name: theme.name,
      color: theme.color,
    };
    setStoredProfileTheme(payload);
    applyProfileTheme(payload);
    rerenderAll();
  }

  async function buyPromo(promoKey) {
    if (isProcessingPurchase) return;
    isProcessingPurchase = true;
    try {
      const result = await apiRequest(`/rewards/purchase/promo/${encodeURIComponent(promoKey)}`, {
        method: 'POST',
      });
      setUserPoints(result.total_points || userPoints);
      purchasedPromosByKey.set(promoKey, {
        key: promoKey,
        code: result.code || '',
      });
      rerenderAll();
    } catch (error) {
      alert(error.message || 'No se pudo comprar el código.');
    } finally {
      isProcessingPurchase = false;
    }
  }

  function wireActions() {
    const themesList = document.getElementById('themesList');
    const promosList = document.getElementById('promosList');

    if (themesList) {
      themesList.addEventListener('click', async (e) => {
        const buyBtn = e.target.closest('[data-theme-buy]');
        if (buyBtn) {
          await buyTheme(String(buyBtn.getAttribute('data-theme-buy') || ''));
          return;
        }

        const applyBtn = e.target.closest('[data-theme-apply]');
        if (applyBtn) {
          applyTheme(String(applyBtn.getAttribute('data-theme-apply') || ''));
        }
      });
    }

    if (promosList) {
      promosList.addEventListener('click', async (e) => {
        const buyBtn = e.target.closest('[data-promo-buy]');
        if (!buyBtn) return;
        await buyPromo(String(buyBtn.getAttribute('data-promo-buy') || ''));
      });
    }
  }

  async function init() {
    try {
      wireActions();
      await loadDashboard();
      rerenderAll();
    } catch (error) {
      console.error('Error inicializando recompensas:', error);
    }
  }

  init();
})(); 