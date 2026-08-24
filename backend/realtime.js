// Lightweight singleton so route modules can emit socket events
// without a circular import of server.js.
let io = null;

function setIO(instance) {
  io = instance;
}

function emit(event, payload) {
  if (io) io.emit(event, payload);
}

module.exports = { setIO, emit };
