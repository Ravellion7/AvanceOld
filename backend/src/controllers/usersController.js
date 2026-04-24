const { listUsers, updateUserAvatar } = require('../models/usersModel');
const { awardFirstAvatarChange } = require('../models/achievementsModel');

async function getUsers(req, res) {
  try {
    const users = await listUsers();
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
}

async function updateMyAvatar(req, res) {
  try {
    const userId = Number(req.user.id);
    const { avatarBase64, avatarMime } = req.body;

    if (!avatarBase64) {
      return res.status(400).json({ message: 'avatarBase64 es requerido' });
    }

    let avatarBuffer;
    try {
      avatarBuffer = Buffer.from(avatarBase64, 'base64');
    } catch (_) {
      return res.status(400).json({ message: 'avatarBase64 invalido' });
    }

    await updateUserAvatar(userId, avatarBuffer, avatarMime || 'image/jpeg');
    await awardFirstAvatarChange(userId).catch(() => null);

    const photo = `data:${avatarMime || 'image/jpeg'};base64,${avatarBase64}`;
    return res.json({ message: 'Foto actualizada', photo });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar foto de perfil', error: error.message });
  }
}

module.exports = {
  getUsers,
  updateMyAvatar,
};
