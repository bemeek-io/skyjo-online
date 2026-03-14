import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameRoom } from './GameRoom.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/types.js';
import { ROOM_CODE_LENGTH } from '../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // In production, __dirname is dist/server, frontend build is in dist/
  const frontendPath = join(__dirname, '..');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/socket.io')) {
      res.sendFile(join(frontendPath, 'index.html'));
    }
  });
}
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173', 
      'http://127.0.0.1:5173',
      'https://skyjo.benmeeker.com',
      'http://skyjo.benmeeker.com'
    ],
    methods: ['GET', 'POST']
  }
});

const rooms = new Map<string, GameRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure unique
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  let currentRoom: GameRoom | null = null;
  let currentPlayerId: string | null = null;

  socket.on('room:create', (playerName, callback) => {
    const roomCode = generateRoomCode();
    const room = new GameRoom(roomCode, io);
    rooms.set(roomCode, room);
    
    const result = room.addPlayer(socket, playerName, true);
    if (result.success) {
      currentRoom = room;
      currentPlayerId = result.playerId!;
      socket.join(roomCode);
      callback({ success: true, roomCode });
      console.log(`🏠 Room ${roomCode} created by ${playerName}`);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  socket.on('room:join', (roomCode, playerName, callback) => {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    const result = room.addPlayer(socket, playerName, false);
    if (result.success) {
      currentRoom = room;
      currentPlayerId = result.playerId!;
      socket.join(roomCode);
      callback({ success: true });
      console.log(`👤 ${playerName} joined room ${roomCode}`);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  socket.on('room:rejoin', (roomCode, playerId, callback) => {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    const result = room.rejoinPlayer(socket, playerId);
    if (result.success) {
      currentRoom = room;
      currentPlayerId = playerId;
      socket.join(roomCode);
      callback({ success: true });
      console.log(`🔄 Player ${playerId} rejoined room ${roomCode}`);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Display mode - create room as display (host but not a player)
  socket.on('room:create-display', (callback) => {
    const roomCode = generateRoomCode();
    const room = new GameRoom(roomCode, io);
    rooms.set(roomCode, room);
    
    const result = room.addDisplay(socket);
    if (result.success) {
      currentRoom = room;
      currentPlayerId = result.displayId!;
      socket.join(roomCode);
      callback({ success: true, roomCode });
      console.log(`📺 Display room ${roomCode} created`);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Join existing room as display
  socket.on('room:join-display', (roomCode, callback) => {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    const result = room.addDisplay(socket);
    if (result.success) {
      currentRoom = room;
      currentPlayerId = result.displayId!;
      socket.join(roomCode.toUpperCase());
      callback({ success: true });
      console.log(`📺 Display joined room ${roomCode}`);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  socket.on('game:start', () => {
    if (currentRoom && currentPlayerId) {
      currentRoom.startGame(currentPlayerId);
    }
  });

  socket.on('game:flip-initial', (cardIndex) => {
    if (currentRoom && currentPlayerId) {
      currentRoom.flipInitialCard(currentPlayerId, cardIndex);
    }
  });

  socket.on('game:draw-card', (fromDiscard) => {
    if (currentRoom && currentPlayerId) {
      currentRoom.drawCard(currentPlayerId, fromDiscard);
    }
  });

  socket.on('game:swap-card', (cardIndex) => {
    if (currentRoom && currentPlayerId) {
      currentRoom.swapCard(currentPlayerId, cardIndex);
    }
  });

  socket.on('game:discard-drawn', (cardIndex) => {
    if (currentRoom && currentPlayerId) {
      currentRoom.discardDrawnCard(currentPlayerId, cardIndex);
    }
  });

  socket.on('game:next-round', () => {
    if (currentRoom && currentPlayerId) {
      currentRoom.startNextRound(currentPlayerId);
    }
  });

  socket.on('game:go-to-lobby', () => {
    if (currentRoom && currentPlayerId) {
      currentRoom.goToLobby(currentPlayerId);
    }
  });

  socket.on('game:end-game', () => {
    if (currentRoom && currentPlayerId) {
      currentRoom.endGame(currentPlayerId);
    }
  });

  socket.on('room:leave', () => {
    if (currentRoom && currentPlayerId) {
      console.log(`🚪 Player ${currentPlayerId} left room ${currentRoom.roomCode}`);
      socket.leave(currentRoom.roomCode);
      currentRoom.removePlayer(currentPlayerId);
      
      // Clean up empty rooms
      if (currentRoom.isEmpty()) {
        io.to(currentRoom.roomCode).emit('room:closed');
        rooms.delete(currentRoom.roomCode);
        console.log(`🗑️ Room ${currentRoom.roomCode} deleted (all players left)`);
      }
      
      currentRoom = null;
      currentPlayerId = null;
    }
  });

  socket.on('room:change-avatar', (avatar) => {
    if (currentRoom && currentPlayerId) {
      currentRoom.changeAvatar(currentPlayerId, avatar);
    }
  });

  socket.on('room:kick', (targetPlayerId) => {
    if (currentRoom && currentPlayerId) {
      // Only host can kick
      const kicker = currentRoom.getPlayer(currentPlayerId);
      if (!kicker?.isHost) {
        console.log(`⚠️ Non-host ${currentPlayerId} tried to kick ${targetPlayerId}`);
        return;
      }
      
      // Get target player's socket and notify them
      const targetSocket = currentRoom.getPlayerSocket(targetPlayerId);
      if (targetSocket) {
        targetSocket.emit('room:kicked');
        targetSocket.leave(currentRoom.roomCode);
      }
      
      currentRoom.removePlayer(targetPlayerId);
      console.log(`🦵 Host kicked player ${targetPlayerId} from room ${currentRoom.roomCode}`);
    }
  });

  socket.on('game:reaction', (emoji) => {
    if (currentRoom && currentPlayerId) {
      // Broadcast reaction to all players in the room
      io.to(currentRoom.roomCode).emit('game:reaction', {
        playerId: currentPlayerId,
        emoji
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    if (currentRoom && currentPlayerId) {
      currentRoom.playerDisconnected(currentPlayerId);
      
      // Clean up empty rooms after a delay (give time to reconnect)
      setTimeout(() => {
        if (currentRoom && currentRoom.isEmpty()) {
          io.to(currentRoom.roomCode).emit('room:closed');
          rooms.delete(currentRoom.roomCode);
          console.log(`🗑️ Room ${currentRoom.roomCode} deleted (empty)`);
        }
      }, 30000); // 30 second grace period
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 SkyJo server running on port ${PORT}`);
});

