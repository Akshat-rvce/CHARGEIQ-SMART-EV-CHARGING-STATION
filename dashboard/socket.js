const socketIo = require('socket.io');

let io = null;

function initSocket(server) {
  if (io && !server) {
    return io;
  }

  if (server) {
    if (io) {
      return io;
    }
    
    io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
      console.log(`[Dashboard WebSocket Client Linked]: ID = ${socket.id}`);
      
      socket.emit('connection_health', { status: 'CONNECTED', latency: 4 });

      socket.on('disconnect', () => {
        console.log(`[Dashboard WebSocket Client Unlinked]: ID = ${socket.id}`);
      });
    });
  }

  return io;
}

function broadcastTelemetry(data) {
  if (io) {
    io.emit('telemetry', data);
  }
}

function broadcastEvent(event) {
  if (io) {
    io.emit('event_log', event);
  }
}

module.exports = {
  initSocket,
  broadcastTelemetry,
  broadcastEvent
};
