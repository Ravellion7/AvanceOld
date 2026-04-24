require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const usersRoutes = require('./routes/usersRoutes');
const chatsRoutes = require('./routes/chatsRoutes');
const friendsRoutes = require('./routes/friendsRoutes');
const messagesRoutes = require('./routes/messagesRoutes');
const tasksRoutes = require('./routes/tasksRoutes');
const rewardsRoutes = require('./routes/rewardsRoutes');
const registerSocketHandlers = require('./sockets');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
].filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Origen no permitido por CORS'));
}

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH'],
  },
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '20mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', service: 'kickmap-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/rewards', rewardsRoutes);

registerSocketHandlers(io);

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`Kickmap backend escuchando en puerto ${PORT}`);
});
