// Socket.IO chat. Same Firebase check as REST; a socket may only join a room for an ACCEPTED request it belongs to.
const { Server } = require('socket.io');
const { User, MentorRequest } = require('./models');
const env = require('./config/env');

function attach(server, verify = require('./config/firebase').verifyCredential) {
  // Same origin allowlist as the REST API (CORS_ORIGINS). Empty list = allow any origin, as before.
  const io = new Server(server, { cors: { origin: env.corsOrigins.length ? env.corsOrigins : true } });
  io.use(async (socket, next) => {
    try {
      const t = socket.handshake.auth && socket.handshake.auth.token;
      const { uid } = await verify(t);
      const u = await User.findOne({ firebaseUid: uid });
      if (!u || u.deletedAt) return next(new Error('no profile')); // deleted accounts cannot open a chat socket
      socket.user = u; next();
    } catch { next(new Error('unauthenticated')); }
  });
  io.on('connection', (socket) => {
    socket.on('join', async (requestId, ack) => {
      try {
        const rq = await MentorRequest.findById(requestId);
        const ok = rq && rq.status === 'accepted' && [String(rq.studentId), String(rq.mentorId)].includes(String(socket.user._id));
        if (!ok) return ack && ack({ error: 'FORBIDDEN' });
        socket.join(`req:${rq._id}`); ack && ack({ ok: true });
      } catch { ack && ack({ error: 'FORBIDDEN' }); }
    });
  });
  return io;
}
module.exports = { attach };
