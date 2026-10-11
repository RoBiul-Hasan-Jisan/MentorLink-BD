// Socket.IO: live chat + live notifications. Authenticated with the SAME Firebase credential as REST
// (verified by the Firebase Admin SDK; we never open the credential ourselves).
const { Server } = require('socket.io');
const firebase = require('./config/firebase');
const env = require('./config/env');
const User = require('./models/User');
const realtime = require('./services/realtime');
const { loadChat, sendMessage, markRead } = require('./services/chat');

function createSocketServer(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false } });
  realtime.setIo(io);

  io.use(async (socket, next) => {
    try {
      const { uid } = await firebase.verifyToken(socket.handshake.auth?.token || '');
      const user = await User.findOne({ firebaseUid: uid });
      if (!user || user.verificationStatus === 'rejected') return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`); // personal room for live notifications
    const reply = (ack, fn) => async (...args) => {
      try { const out = await fn(...args); if (typeof ack === 'function') ack({ ok: true, ...out }); }
      catch (e) { if (typeof ack === 'function') ack({ ok: false, error: e.code || 'ERROR', message: e.message }); }
    };
    // join a chat room: only allowed for the two people on an ACCEPTED request
    socket.on('join', (p, ack) => reply(ack, async () => { await loadChat(p?.requestId, socket.user); socket.join(`chat:${p.requestId}`); return {}; })());
    socket.on('message', (p, ack) => reply(ack, async () => ({ message: await sendMessage(socket.user, p?.requestId, { body: p?.body, clientId: p?.clientId }) }))());
    socket.on('read', (p, ack) => reply(ack, async () => ({ marked: await markRead(socket.user, p?.requestId) }))());
  });
  return io;
}
module.exports = { createSocketServer };
