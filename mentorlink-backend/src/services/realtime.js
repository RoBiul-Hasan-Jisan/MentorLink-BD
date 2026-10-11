// Holds the Socket.IO instance so any service can push live events. No-op when sockets are off (tests).
let io = null;
module.exports = {
  setIo: (instance) => { io = instance; },
  emitToUser: (userId, event, payload) => { if (io) io.to(`user:${userId}`).emit(event, payload); },
  emitToRoom: (room, event, payload) => { if (io) io.to(room).emit(event, payload); },
};
