require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');
const path = require('path');
const { ExpressPeerServer } = require('peer');

const authRoutes = require('./routes/authRoutes');
const usersRoutes = require('./routes/usersRoutes');
const chatsRoutes = require('./routes/chatsRoutes');
const friendsRoutes = require('./routes/friendsRoutes');
const messagesRoutes = require('./routes/messagesRoutes');
const tasksRoutes = require('./routes/tasksRoutes');
const rewardsRoutes = require('./routes/rewardsRoutes');
const postsRoutes = require('./routes/postsRoutes');
const registerSocketHandlers = require('./sockets');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
].filter(Boolean);

const allowedOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i,
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
}

function corsOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) {
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
  maxHttpBufferSize: 10 * 1024 * 1024,
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '20mb' }));
app.use(morgan('dev'));

const projectRoot = path.resolve(__dirname, '..', '..');
app.use(express.static(path.join(projectRoot, 'HTML')));
app.use('/HTML', express.static(path.join(projectRoot, 'HTML')));
app.use('/CSS', express.static(path.join(projectRoot, 'CSS')));
app.use('/JS', express.static(path.join(projectRoot, 'JS')));
app.use('/Images', express.static(path.join(projectRoot, 'Images')));
app.use('/peerjs', peerServer);

app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', service: 'kickmap-backend' });
});

app.get('/', (req, res) => {
  return res.sendFile(path.join(projectRoot, 'HTML', 'landing.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/posts', postsRoutes);

registerSocketHandlers(io);

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`Kickmap backend escuchando en puerto ${PORT}`);
});
