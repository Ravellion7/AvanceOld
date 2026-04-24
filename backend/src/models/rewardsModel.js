const { query, pool } = require('../config/db');
const { getUserAchievementState } = require('./achievementsModel');

const PROFILE_THEMES = [
  {
    key: 'verde_clasico',
    name: 'Verde Clásico',
    description: 'Tema estándar de la plataforma',
    points_cost: 100,
    color: '#0f8a3a',
  },
  {
    key: 'azul_premium',
    name: 'Azul Premium',
    description: 'Tema azul elegante',
    points_cost: 150,
    color: '#1e40af',
  },
  {
    key: 'purpura_oscuro',
    name: 'Púrpura Oscuro',
    description: 'Tema oscuro y sofisticado',
    points_cost: 200,
    color: '#6d28d9',
  },
];

const PROMO_REWARDS = [
  {
    key: 'promo_10',
    name: 'Cupón Descuento 10%',
    description: 'Descuento del 10% en tiendas asociadas',
    points_cost: 75,
    code_prefix: 'POI-10',
  },
  {
    key: 'promo_20',
    name: 'Cupón Descuento 20%',
    description: 'Descuento del 20% en tiendas asociadas',
    points_cost: 150,
    code_prefix: 'POI-20',
  },
  {
    key: 'premium_7d',
    name: 'Código Premium +7d',
    description: 'Acceso premium por 7 días',
    points_cost: 250,
    code_prefix: 'POI-PREM',
  },
];

const THEME_BY_KEY = new Map(PROFILE_THEMES.map((item) => [item.key, item]));
const PROMO_BY_KEY = new Map(PROMO_REWARDS.map((item) => [item.key, item]));
const THEME_BY_NAME = new Map(PROFILE_THEMES.map((item) => [item.name, item]));
const PROMO_BY_NAME = new Map(PROMO_REWARDS.map((item) => [item.name, item]));

function generatePromoCode(codePrefix, userRewardId) {
  const paddedId = String(userRewardId || 0).padStart(6, '0');
  return `${codePrefix}-${paddedId}`;
}

async function ensureRewardRow(conn, rewardItem) {
  const [existingRows] = await conn.execute(
    'SELECT id, points_cost, is_active FROM rewards WHERE name = ? LIMIT 1',
    [rewardItem.name]
  );

  if (existingRows[0]) {
    return existingRows[0];
  }

  const [insertResult] = await conn.execute(
    'INSERT INTO rewards (name, description, points_cost, is_active) VALUES (?, ?, ?, 1)',
    [rewardItem.name, rewardItem.description, rewardItem.points_cost]
  );

  return {
    id: insertResult.insertId,
    points_cost: rewardItem.points_cost,
    is_active: 1,
  };
}

function getCatalogItem(itemType, itemKey) {
  if (itemType === 'theme') {
    return THEME_BY_KEY.get(itemKey);
  }

  if (itemType === 'promo') {
    return PROMO_BY_KEY.get(itemKey);
  }

  return null;
}

async function purchaseCatalogItem({ userId, itemType, itemKey }) {
  const catalogItem = getCatalogItem(itemType, itemKey);

  if (!catalogItem) {
    throw new Error('Recompensa no disponible');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const rewardRow = await ensureRewardRow(conn, catalogItem);
    if (Number(rewardRow.is_active) !== 1) {
      throw new Error('Recompensa no disponible');
    }
    const rewardCost = Number(rewardRow.points_cost || catalogItem.points_cost);

    const [existingRows] = await conn.execute(
      'SELECT id FROM user_rewards WHERE user_id = ? AND reward_id = ? LIMIT 1',
      [userId, rewardRow.id]
    );

    if (existingRows[0]) {
      throw new Error('Ya compraste esta recompensa');
    }

    const [userRows] = await conn.execute(
      'SELECT total_points FROM user_points WHERE user_id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );

    const user = userRows[0];
    if (!user || Number(user.total_points) < rewardCost) {
      throw new Error('Puntos insuficientes');
    }

    await conn.execute(
      'UPDATE user_points SET total_points = total_points - ? WHERE user_id = ?',
      [rewardCost, userId]
    );

    const [insertResult] = await conn.execute(
      'INSERT INTO user_rewards (user_id, reward_id) VALUES (?, ?)',
      [userId, rewardRow.id]
    );

    const newTotalPoints = Number(user.total_points) - rewardCost;
    const response = {
      purchased: true,
      item_type: itemType,
      item_key: catalogItem.key,
      points_spent: rewardCost,
      total_points: newTotalPoints,
    };

    if (itemType === 'promo') {
      response.code = generatePromoCode(catalogItem.code_prefix, insertResult.insertId);
    }

    await conn.commit();
    return response;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getRanking() {
  return query(
    `SELECT u.id, u.name, up.total_points
     FROM user_points up
     INNER JOIN users u ON u.id = up.user_id
     ORDER BY up.total_points DESC, u.name ASC`
  );
}

async function listRewards() {
  return query(
    `SELECT id, name, description, points_cost, is_active, created_at
     FROM rewards
     WHERE is_active = 1
     ORDER BY points_cost ASC`
  );
}

async function redeemReward({ userId, rewardId }) {
  const rewardRows = await query(
    'SELECT id, points_cost, is_active FROM rewards WHERE id = ? LIMIT 1',
    [rewardId]
  );
  const reward = rewardRows[0];

  if (!reward || reward.is_active !== 1) {
    throw new Error('Recompensa no disponible');
  }

  const existingRows = await query(
    'SELECT id FROM user_rewards WHERE user_id = ? AND reward_id = ? LIMIT 1',
    [userId, rewardId]
  );

  if (existingRows[0]) {
    throw new Error('Esta recompensa ya fue canjeada');
  }

  const userRows = await query('SELECT total_points FROM user_points WHERE user_id = ? LIMIT 1', [userId]);
  const user = userRows[0];

  if (!user || user.total_points < reward.points_cost) {
    throw new Error('Puntos insuficientes');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      'UPDATE user_points SET total_points = total_points - ? WHERE user_id = ?',
      [reward.points_cost, userId]
    );

    await conn.execute('INSERT INTO user_rewards (user_id, reward_id) VALUES (?, ?)', [userId, rewardId]);

    await conn.commit();
    return { redeemed: true, cost: reward.points_cost };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getRewardDashboard(userId) {
  const pointsRows = await query('SELECT total_points FROM user_points WHERE user_id = ? LIMIT 1', [userId]);
  const rewardsRows = await query(
    `SELECT ur.id AS user_reward_id, ur.reward_id, r.name, r.description, r.points_cost, ur.redeemed_at
     FROM user_rewards ur
     INNER JOIN rewards r ON r.id = ur.reward_id
     WHERE ur.user_id = ?
     ORDER BY ur.redeemed_at DESC`,
    [userId]
  );

  const ownedThemes = rewardsRows
    .map((row) => {
      const theme = THEME_BY_NAME.get(row.name);
      if (!theme) return null;
      return {
        key: theme.key,
        name: theme.name,
        color: theme.color,
        points_cost: Number(row.points_cost),
        redeemed_at: row.redeemed_at,
      };
    })
    .filter(Boolean);

  const ownedPromos = rewardsRows
    .map((row) => {
      const promo = PROMO_BY_NAME.get(row.name);
      if (!promo) return null;
      return {
        user_reward_id: Number(row.user_reward_id),
        key: promo.key,
        name: promo.name,
        points_cost: Number(row.points_cost),
        redeemed_at: row.redeemed_at,
      };
    })
    .filter(Boolean);

  const achievementState = await getUserAchievementState(userId);

  return {
    total_points: Number(pointsRows[0]?.total_points || 0),
    redeemed_rewards: rewardsRows,
    purchased_theme_keys: ownedThemes.map((item) => item.key),
    purchased_promo_keys: ownedPromos.map((item) => item.key),
    purchased_promos: ownedPromos.map((item) => {
      const promoMeta = PROMO_BY_KEY.get(item.key);
      return {
        ...item,
        code: generatePromoCode(promoMeta.code_prefix, item.user_reward_id || 0),
      };
    }),
    unlocked_achievement_keys: achievementState.unlocked_achievement_keys,
    unlocked_achievements: achievementState.unlocked_achievements,
  };
}

module.exports = {
  getRanking,
  listRewards,
  redeemReward,
  purchaseCatalogItem,
  getRewardDashboard,
};
