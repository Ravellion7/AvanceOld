const {
  getRanking,
  listRewards,
  redeemReward,
  getRewardDashboard,
  purchaseCatalogItem,
} = require('../models/rewardsModel');

async function ranking(req, res) {
  try {
    const rows = await getRanking();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener ranking', error: error.message });
  }
}

async function rewards(req, res) {
  try {
    const rows = await listRewards();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener recompensas', error: error.message });
  }
}

async function me(req, res) {
  try {
    const userId = Number(req.user.id);
    const dashboard = await getRewardDashboard(userId);
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener estado de recompensas', error: error.message });
  }
}

async function redeem(req, res) {
  try {
    const userId = Number(req.user.id);
    const rewardId = Number(req.params.rewardId);
    const result = await redeemReward({ userId, rewardId });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function purchaseTheme(req, res) {
  try {
    const userId = Number(req.user.id);
    const themeKey = String(req.params.themeKey || '');
    const result = await purchaseCatalogItem({
      userId,
      itemType: 'theme',
      itemKey: themeKey,
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function purchasePromo(req, res) {
  try {
    const userId = Number(req.user.id);
    const promoKey = String(req.params.promoKey || '');
    const result = await purchaseCatalogItem({
      userId,
      itemType: 'promo',
      itemKey: promoKey,
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  ranking,
  rewards,
  me,
  redeem,
  purchaseTheme,
  purchasePromo,
};
