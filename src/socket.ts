import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../shared/types';

const URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

// Connection event listeners
socket.on('connect', () => {
  console.log('🔌 Connected to server');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

