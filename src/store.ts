import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, Player, CardValue, ReactionEmoji, PlayerAction } from '../shared/types';

// Floating reaction type
export interface FloatingReaction {
  id: string;
  playerId: string;
  emoji: ReactionEmoji;
  timestamp: number;
}

// Player action indicator
export interface ActionIndicator {
  playerId: string;
  action: PlayerAction;
  timestamp: number;
}

interface GameStore {
  // Connection state
  connected: boolean;
  setConnected: (connected: boolean) => void;
  
  // Player info
  playerId: string | null;
  playerName: string;
  roomCode: string | null;
  setPlayerInfo: (playerId: string, roomCode: string) => void;
  setPlayerName: (name: string) => void;
  clearSession: () => void;
  
  // Players in room
  players: Player[];
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayerConnection: (playerId: string, connected: boolean) => void;
  updatePlayerAvatar: (playerId: string, avatar: string) => void;
  
  // Game state
  gameState: GameState | null;
  setGameState: (state: GameState | ((prev: GameState | null) => GameState | null)) => void;
  
  // Track where the drawn card came from
  drawnFromDiscard: boolean;
  setDrawnFromDiscard: (fromDiscard: boolean) => void;
  
  // Local UI state - my drawn card (for interaction)
  drawnCard: CardValue | null;
  setDrawnCard: (card: CardValue | null) => void;
  
  // Current turn's drawn card (visible to everyone)
  currentTurnDrawnCard: CardValue | null;
  currentTurnDrawnBy: string | null;
  currentTurnFromDiscard: boolean;
  setCurrentTurnDraw: (card: CardValue | null, playerId: string | null, fromDiscard: boolean) => void;
  
  // Messages/errors
  error: string | null;
  setError: (error: string | null) => void;
  
  // View state
  view: 'home' | 'lobby' | 'game' | 'display';
  setView: (view: 'home' | 'lobby' | 'game' | 'display') => void;
  
  // Reactions
  reactions: FloatingReaction[];
  addReaction: (playerId: string, emoji: ReactionEmoji) => void;
  removeReaction: (id: string) => void;
  
  // Player actions (for showing what other players are doing)
  playerActions: ActionIndicator[];
  setPlayerAction: (playerId: string, action: PlayerAction) => void;
  clearPlayerAction: (playerId: string) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      connected: false,
      setConnected: (connected) => set({ connected }),
      
      playerId: null,
      playerName: '',
      roomCode: null,
      setPlayerInfo: (playerId, roomCode) => set({ playerId, roomCode }),
      setPlayerName: (name) => set({ playerName: name }),
      clearSession: () => set({ playerId: null, roomCode: null, gameState: null, players: [], view: 'home' }),
      
      players: [],
      setPlayers: (players) => set({ players }),
      addPlayer: (player) => set((state) => ({ 
        players: [...state.players.filter(p => p.id !== player.id), player] 
      })),
      removePlayer: (playerId) => set((state) => ({
        players: state.players.filter(p => p.id !== playerId)
      })),
      updatePlayerConnection: (playerId, connected) => set((state) => ({
        players: state.players.map(p => p.id === playerId ? { ...p, connected } : p)
      })),
      updatePlayerAvatar: (playerId, avatar) => set((state) => ({
        players: state.players.map(p => p.id === playerId ? { ...p, avatar } : p)
      })),
      
      gameState: null,
      setGameState: (stateOrUpdater) => set((prev) => {
        if (typeof stateOrUpdater === 'function') {
          return { gameState: stateOrUpdater(prev.gameState) };
        }
        return { gameState: stateOrUpdater };
      }),
      
      drawnFromDiscard: false,
      setDrawnFromDiscard: (fromDiscard) => set({ drawnFromDiscard: fromDiscard }),
      
      drawnCard: null,
      setDrawnCard: (card) => set({ drawnCard: card }),
      
      currentTurnDrawnCard: null,
      currentTurnDrawnBy: null,
      currentTurnFromDiscard: false,
      setCurrentTurnDraw: (card, playerId, fromDiscard) => set({ 
        currentTurnDrawnCard: card, 
        currentTurnDrawnBy: playerId,
        currentTurnFromDiscard: fromDiscard
      }),
      
      error: null,
      setError: (error) => set({ error }),
      
      view: 'home',
      setView: (view) => set({ view }),
      
      reactions: [],
      addReaction: (playerId, emoji) => set((state) => {
        const id = `${playerId}-${Date.now()}-${Math.random()}`;
        const newReaction: FloatingReaction = {
          id,
          playerId,
          emoji,
          timestamp: Date.now()
        };
        // Keep only last 10 reactions to prevent memory leaks
        const reactions = [...state.reactions, newReaction].slice(-10);
        return { reactions };
      }),
      removeReaction: (id) => set((state) => ({
        reactions: state.reactions.filter(r => r.id !== id)
      })),
      
      playerActions: [],
      setPlayerAction: (playerId, action) => set((state) => {
        const existing = state.playerActions.filter(a => a.playerId !== playerId);
        return {
          playerActions: [...existing, { playerId, action, timestamp: Date.now() }]
        };
      }),
      clearPlayerAction: (playerId) => set((state) => ({
        playerActions: state.playerActions.filter(a => a.playerId !== playerId)
      })),
    }),
    {
      name: 'skyjo-game',
      partialize: (state) => ({
        playerId: state.playerId,
        playerName: state.playerName,
        roomCode: state.roomCode,
        view: state.view,
      }),
    }
  )
);

