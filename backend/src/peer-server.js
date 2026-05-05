const { PeerServer } = require('peer');

const port = Number(process.env.PEER_PORT || 9000);
const path = process.env.PEER_PATH || '/peerjs';

const server = PeerServer({ port, path });

server.on('connection', (client) => {
  console.log('Peer connected:', client.id);
});

server.on('disconnect', (client) => {
  console.log('Peer disconnected:', client.id);
});

console.log(`PeerServer running on port ${port}${path}`);
