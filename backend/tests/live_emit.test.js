// DB-free: the live-notification helper must be a safe no-op without a socket server and must target the person's own room.
const { emitToUser, setIo } = require('../src/realtime');

describe('emitToUser', () => {
  afterEach(() => setIo(null));
  test('does nothing when no socket server is running', () => {
    expect(() => emitToUser('u1', 'notification', {})).not.toThrow();
  });
  test('sends to that person\'s own room only', () => {
    const calls = [];
    setIo({ to: (room) => ({ emit: (ev, p) => calls.push([room, ev, p]) }) });
    emitToUser('u1', 'notification', { a: 1 });
    expect(calls).toEqual([['user:u1', 'notification', { a: 1 }]]);
  });
  test('a failing socket never breaks the caller', () => {
    setIo({ to: () => { throw new Error('boom'); } });
    expect(() => emitToUser('u1', 'x', {})).not.toThrow();
  });
});
