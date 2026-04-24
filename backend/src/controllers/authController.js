const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUserByEmail, createUser } = require('../models/authModel');
const { updateUserStatus } = require('../models/usersModel');

async function register(req, res) {
  try {
    const { name, email, password, avatarBase64, avatarMime } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email y password son requeridos' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'El correo ya esta registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let avatarBuffer = null;

    if (avatarBase64) {
      try {
        avatarBuffer = Buffer.from(avatarBase64, 'base64');
      } catch (_) {
        return res.status(400).json({ message: 'avatarBase64 invalido' });
      }
    }

    const user = await createUser({
      name,
      email,
      passwordHash,
      avatarBuffer,
      avatarMime: avatarMime || null,
    });

    return res.status(201).json({ message: 'Usuario creado', user });
  } catch (error) {
    return res.status(500).json({ message: 'Error al registrar usuario', error: error.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email y password son requeridos' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await updateUserStatus(user.id, true);

    let photo = null;
    if (user.avatar_data) {
      const mime = user.avatar_mime || 'image/jpeg';
      photo = `data:${mime};base64,${Buffer.from(user.avatar_data).toString('base64')}`;
    }

    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        photo,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error en login', error: error.message });
  }
}

module.exports = {
  register,
  login,
};
