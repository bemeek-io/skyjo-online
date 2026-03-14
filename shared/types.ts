// SkyJo card values range from -2 to 12
export type CardValue = -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface Card {
  value: CardValue;
  revealed: boolean;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string; // Emoji avatar
  cards: Card[]; // 12 cards in a 3x4 grid (row-major order)
  score: number;
  connected: boolean;
  isHost: boolean;
  isDisplay?: boolean; // Display-only mode (TV/spectator view)
}

export interface GameState {
  roomCode: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: CardValue[];
  discardPile: CardValue[];
  phase: GamePhase;
  drawnCard: CardValue | null; // Card currently drawn from deck
  drawnFromDiscard: boolean; // Whether the drawn card was from discard pile
  roundNumber: number;
  roundScores: Record<string, number[]>; // player id -> scores per round
  lastRoundTriggeredBy: string | null;
  turnsRemainingAfterTrigger: number;
  winner: string | null;
}

export type GamePhase = 
  | 'waiting'      // Waiting for players to join
  | 'initial-flip' // Players flipping their 2 initial cards
  | 'playing'      // Main game phase
  | 'round-end'    // Round just ended, showing scores
  | 'game-over';   // Game finished

// Reaction emojis
export type ReactionEmoji = '👍' | '😮' | '😭' | '🎉' | '🔥' | '😂';

// Player action types for indicators
export type PlayerAction = 'drawing-deck' | 'drawing-discard' | 'swapping' | 'flipping';

// Socket events
export interface ServerToClientEvents {
  'room:joined': (data: { roomCode: string; playerId: string; players: Player[] }) => void;
  'room:player-joined': (player: Player) => void;
  'room:player-left': (playerId: string) => void;
  'room:player-reconnected': (playerId: string) => void;
  'room:avatar-changed': (data: { playerId: string; avatar: string }) => void;
  'room:closed': () => void;
  'room:kicked': () => void; // Notifies a player they were kicked
  'game:state': (state: GameState) => void;
  'game:started': (state: GameState) => void;
  'game:card-flipped': (data: { playerId: string; cardIndex: number; value: CardValue }) => void;
  'game:turn-update': (data: { currentPlayerIndex: number; drawnCard: CardValue | null }) => void;
  'game:card-drawn': (data: { fromDiscard: boolean; card: CardValue | null; deckCount: number; discardCount: number; playerId: string }) => void;
  'game:card-swapped': (data: { playerId: string; cardIndex: number; newCard: CardValue; discarded: CardValue; deckCount: number; discardCount: number }) => void;
  'game:card-discarded': (data: { discarded: CardValue; deckCount: number; discardCount: number }) => void;
  'game:column-cleared': (data: { playerId: string; column: number; clearedValue: CardValue }) => void;
  'game:round-ended': (data: { scores: Record<string, number>; triggeredBy: string }) => void;
  'game:game-over': (data: { winner: string; finalScores: Record<string, number> }) => void;
  'game:reaction': (data: { playerId: string; emoji: ReactionEmoji }) => void;
  'game:player-action': (data: { playerId: string; action: PlayerAction }) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (playerName: string, callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  'room:create-display': (callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  'room:join': (roomCode: string, playerName: string, callback: (response: { success: boolean; error?: string }) => void) => void;
  'room:join-display': (roomCode: string, callback: (response: { success: boolean; error?: string }) => void) => void;
  'room:rejoin': (roomCode: string, playerId: string, callback: (response: { success: boolean; error?: string }) => void) => void;
  'room:leave': () => void;
  'room:kick': (playerId: string) => void; // Host can kick a player
  'room:change-avatar': (avatar: string) => void; // Change avatar in lobby
  'game:start': () => void;
  'game:flip-initial': (cardIndex: number) => void;
  'game:draw-card': (fromDiscard: boolean) => void;
  'game:swap-card': (cardIndex: number) => void;
  'game:discard-drawn': (cardIndex: number) => void; // Discard drawn card and flip a card
  'game:next-round': () => void; // Start next round from lobby
  'game:go-to-lobby': () => void; // Go to lobby after round-end
  'game:end-game': () => void; // Host can end the game and reset scores
  'game:reaction': (emoji: ReactionEmoji) => void; // Send emoji reaction
}

