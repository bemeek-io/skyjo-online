import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import type { 
  GameState, 
  Player, 
  Card, 
  CardValue, 
  ServerToClientEvents, 
  ClientToServerEvents,
  GamePhase
} from '../shared/types.js';
import { 
  CARD_DISTRIBUTION, 
  CARDS_PER_PLAYER, 
  MIN_PLAYERS, 
  MAX_PLAYERS,
  GRID_COLS,
  GRID_ROWS,
  WINNING_SCORE,
  AVATARS
} from '../shared/constants.js';

export class GameRoom {
  roomCode: string;
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private state: GameState;
  private playerSockets: Map<string, Socket> = new Map();
  private initialFlipsRemaining: Map<string, number> = new Map();

  constructor(roomCode: string, io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.roomCode = roomCode;
    this.io = io;
    this.state = {
      roomCode,
      players: [],
      currentPlayerIndex: 0,
      deck: [],
      discardPile: [],
      phase: 'waiting',
      drawnCard: null,
      drawnFromDiscard: false,
      roundNumber: 0,
      roundScores: {},
      lastRoundTriggeredBy: null,
      turnsRemainingAfterTrigger: 0,
      winner: null
    };
  }

  private getAvailableAvatars(): string[] {
    const usedAvatars = new Set(this.state.players.map(p => p.avatar));
    return AVATARS.filter(a => !usedAvatars.has(a));
  }

  private getRandomAvatar(): string {
    const available = this.getAvailableAvatars();
    if (available.length === 0) {
      // Fallback: all avatars taken, pick random (shouldn't happen with 20 avatars and 20 max players)
      return AVATARS[Math.floor(Math.random() * AVATARS.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  addPlayer(socket: Socket, name: string, isHost: boolean): { success: boolean; playerId?: string; error?: string } {
    if (this.state.players.length >= MAX_PLAYERS) {
      return { success: false, error: 'Room is full' };
    }
    if (this.state.phase !== 'waiting') {
      return { success: false, error: 'Game already in progress' };
    }

    // Validate name length (max 20 characters)
    const trimmedName = name.trim().slice(0, 20);
    if (trimmedName.length === 0) {
      return { success: false, error: 'Name cannot be empty' };
    }

    // Check for duplicate names (case-insensitive)
    const nameTaken = this.state.players.some(
      p => p.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameTaken) {
      return { success: false, error: 'Someone with that name is already playing' };
    }

    // If no players yet, this player becomes host
    const shouldBeHost = isHost || this.state.players.length === 0;

    const playerId = uuid();
    const player: Player = {
      id: playerId,
      name: trimmedName,
      avatar: this.getRandomAvatar(),
      cards: [],
      score: 0,
      connected: true,
      isHost: shouldBeHost
    };

    this.state.players.push(player);
    this.state.roundScores[playerId] = [];
    this.playerSockets.set(playerId, socket);

    // Notify the joining player
    socket.emit('room:joined', {
      roomCode: this.roomCode,
      playerId,
      players: this.state.players
    });

    // Notify others (including displays) - use io.to to reach everyone in the room
    this.io.to(this.roomCode).emit('room:player-joined', player);

    return { success: true, playerId };
  }

  addDisplay(socket: Socket): { success: boolean; displayId?: string; error?: string } {
    const displayId = uuid();
    
    // Display doesn't count as a player, just observes
    this.playerSockets.set(displayId, socket);

    // Send current game state to display
    socket.emit('room:joined', {
      roomCode: this.roomCode,
      playerId: displayId,
      players: this.state.players
    });
    socket.emit('game:state', this.state);

    return { success: true, displayId };
  }

  rejoinPlayer(socket: Socket, playerId: string): { success: boolean; error?: string } {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in this room' };
    }

    player.connected = true;
    this.playerSockets.set(playerId, socket);

    // Send current game state
    socket.emit('room:joined', {
      roomCode: this.roomCode,
      playerId,
      players: this.state.players
    });
    socket.emit('game:state', this.state);

    // Notify others (including displays)
    this.io.to(this.roomCode).emit('room:player-reconnected', playerId);

    return { success: true };
  }

  playerDisconnected(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      this.playerSockets.delete(playerId);
      this.io.to(this.roomCode).emit('room:player-left', playerId);
    }
  }

  changeAvatar(playerId: string, newAvatar: string): void {
    // Only allow during waiting phase
    if (this.state.phase !== 'waiting') {
      this.sendError(playerId, 'Cannot change avatar during game');
      return;
    }

    // Check if avatar is valid
    if (!AVATARS.includes(newAvatar as typeof AVATARS[number])) {
      this.sendError(playerId, 'Invalid avatar');
      return;
    }

    // Check if avatar is available
    const isUsedBySomeoneElse = this.state.players.some(p => p.avatar === newAvatar && p.id !== playerId);
    if (isUsedBySomeoneElse) {
      this.sendError(playerId, 'Avatar already taken');
      return;
    }

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    player.avatar = newAvatar;
    
    // Notify all players
    this.io.to(this.roomCode).emit('room:avatar-changed', { playerId, avatar: newAvatar });
  }

  removePlayer(playerId: string): void {
    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const wasHost = this.state.players[playerIndex].isHost;
    this.state.players.splice(playerIndex, 1);
    this.playerSockets.delete(playerId);
    delete this.state.roundScores[playerId];

    // If the removed player was the host, assign a new host
    if (wasHost && this.state.players.length > 0) {
      const newHost = this.state.players.find(p => p.connected) || this.state.players[0];
      if (newHost) {
        newHost.isHost = true;
        console.log(`👑 ${newHost.name} is now the host`);
      }
    }

    // Notify others about the player leaving
    this.io.to(this.roomCode).emit('room:player-left', playerId);
    
    // Send updated game state so clients know about new host
    this.io.to(this.roomCode).emit('game:state', this.state);

    // If we're in a game and it's this player's turn, advance
    if (this.state.phase === 'playing' && this.state.players.length > 0) {
      if (this.state.currentPlayerIndex >= this.state.players.length) {
        this.state.currentPlayerIndex = 0;
      }
      this.io.to(this.roomCode).emit('game:state', this.state);
    }

    // If no connected players remain, the room will be cleaned up by the server
  }

  isEmpty(): boolean {
    return this.state.players.length === 0 || this.state.players.every(p => !p.connected);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.state.players.find(p => p.id === playerId);
  }

  getPlayerSocket(playerId: string): Socket | undefined {
    return this.playerSockets.get(playerId);
  }

  startGame(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player?.isHost) {
      this.sendError(playerId, 'Only the host can start the game');
      return;
    }
    if (this.state.players.length < MIN_PLAYERS) {
      this.sendError(playerId, `Need at least ${MIN_PLAYERS} players to start`);
      return;
    }

    this.initializeRound();
    this.state.phase = 'initial-flip';
    this.state.roundNumber = 1;

    // Each player needs to flip 2 cards
    this.state.players.forEach(p => {
      this.initialFlipsRemaining.set(p.id, 2);
    });

    this.io.to(this.roomCode).emit('game:started', this.state);
  }

  private initializeRound(): void {
    // Calculate number of decks needed (1 deck per 8 players)
    const activePlayers = this.state.players.filter(p => !p.isDisplay).length;
    const numDecks = Math.ceil(activePlayers / 8);
    
    // Create deck(s)
    this.state.deck = [];
    for (let deck = 0; deck < numDecks; deck++) {
      for (const [value, count] of Object.entries(CARD_DISTRIBUTION)) {
        for (let i = 0; i < count; i++) {
          this.state.deck.push(parseInt(value) as CardValue);
        }
      }
    }
    this.shuffleDeck();

    // Deal cards to players
    for (const player of this.state.players) {
      player.cards = [];
      for (let i = 0; i < CARDS_PER_PLAYER; i++) {
        player.cards.push({
          value: this.state.deck.pop()!,
          revealed: false,
          id: uuid()
        });
      }
    }

    // Start discard pile
    this.state.discardPile = [this.state.deck.pop()!];
    this.state.drawnCard = null;
    this.state.lastRoundTriggeredBy = null;
    this.state.turnsRemainingAfterTrigger = 0;
  }

  private shuffleDeck(): void {
    for (let i = this.state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.deck[i], this.state.deck[j]] = [this.state.deck[j], this.state.deck[i]];
    }
  }

  flipInitialCard(playerId: string, cardIndex: number): void {
    if (this.state.phase !== 'initial-flip') {
      this.sendError(playerId, 'Not in initial flip phase');
      return;
    }

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    const remaining = this.initialFlipsRemaining.get(playerId) ?? 0;
    if (remaining <= 0) {
      this.sendError(playerId, 'You already flipped 2 cards');
      return;
    }

    if (cardIndex < 0 || cardIndex >= player.cards.length) {
      this.sendError(playerId, 'Invalid card index');
      return;
    }

    const card = player.cards[cardIndex];
    if (card.revealed) {
      this.sendError(playerId, 'Card already revealed');
      return;
    }

    card.revealed = true;
    this.initialFlipsRemaining.set(playerId, remaining - 1);

    this.io.to(this.roomCode).emit('game:card-flipped', {
      playerId,
      cardIndex,
      value: card.value
    });

    // Check if all players have flipped 2 cards
    const allDone = Array.from(this.initialFlipsRemaining.values()).every(r => r === 0);
    if (allDone) {
      this.state.phase = 'playing';
      
      // Determine starting player: highest total of revealed cards goes first
      let highestTotal = -Infinity;
      let startingPlayerIndex = 0;
      
      // Only count actual players (not displays)
      const activePlayers = this.state.players.filter(p => !p.isDisplay);
      
      activePlayers.forEach((player, index) => {
        const revealedTotal = player.cards
          .filter(c => c.revealed)
          .reduce((sum, c) => sum + c.value, 0);
        
        if (revealedTotal > highestTotal) {
          highestTotal = revealedTotal;
          startingPlayerIndex = this.state.players.indexOf(player);
        }
      });
      
      this.state.currentPlayerIndex = startingPlayerIndex;
      this.io.to(this.roomCode).emit('game:state', this.state);
    }
  }

  drawCard(playerId: string, fromDiscard: boolean): void {
    if (!this.isPlayerTurn(playerId)) {
      this.sendError(playerId, 'Not your turn');
      return;
    }
    if (this.state.drawnCard !== null) {
      this.sendError(playerId, 'You already drew a card');
      return;
    }

    let card: CardValue;
    if (fromDiscard) {
      if (this.state.discardPile.length === 0) {
        this.sendError(playerId, 'Discard pile is empty');
        return;
      }
      card = this.state.discardPile.pop()!;
    } else {
      if (this.state.deck.length === 0) {
        // Reshuffle discard pile into deck
        const topDiscard = this.state.discardPile.pop()!;
        this.state.deck = [...this.state.discardPile];
        this.state.discardPile = [topDiscard];
        this.shuffleDeck();
      }
      card = this.state.deck.pop()!;
    }

    this.state.drawnCard = card;
    this.state.drawnFromDiscard = fromDiscard;

    // Send card value to the player who drew
    const socket = this.playerSockets.get(playerId);
    const deckCount = this.state.deck.length;
    const discardCount = this.state.discardPile.length;
    
    // Send card value to ALL players (so everyone can see what was drawn)
    this.io.to(this.roomCode).emit('game:card-drawn', { 
      fromDiscard, 
      card, 
      deckCount, 
      discardCount, 
      playerId 
    });
    
    // Also send full state update to ensure displays stay in sync
    this.io.to(this.roomCode).emit('game:state', this.state);
  }

  swapCard(playerId: string, cardIndex: number): void {
    if (!this.isPlayerTurn(playerId)) {
      this.sendError(playerId, 'Not your turn');
      return;
    }
    if (this.state.drawnCard === null) {
      this.sendError(playerId, 'You need to draw a card first');
      return;
    }

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    if (cardIndex < 0 || cardIndex >= player.cards.length) {
      this.sendError(playerId, 'Invalid card index');
      return;
    }

    const oldCard = player.cards[cardIndex];
    const newValue = this.state.drawnCard;
    const discardedValue = oldCard.value;

    // Swap the card
    player.cards[cardIndex] = {
      value: newValue,
      revealed: true,
      id: uuid()
    };

    // Add old card to discard pile
    this.state.discardPile.push(discardedValue);
    this.state.drawnCard = null;

    this.io.to(this.roomCode).emit('game:card-swapped', {
      playerId,
      cardIndex,
      newCard: newValue,
      discarded: discardedValue,
      deckCount: this.state.deck.length,
      discardCount: this.state.discardPile.length
    });

    // Check for matching column
    this.checkAndClearColumn(player, cardIndex);

    // Check for round end or advance turn
    this.afterTurn(playerId);
    
    // Send full state update to ensure displays stay in sync
    this.io.to(this.roomCode).emit('game:state', this.state);
  }

  discardDrawnCard(playerId: string, cardIndex: number): void {
    if (!this.isPlayerTurn(playerId)) {
      this.sendError(playerId, 'Not your turn');
      return;
    }
    if (this.state.drawnCard === null) {
      this.sendError(playerId, 'You need to draw a card first');
      return;
    }

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    if (cardIndex < 0 || cardIndex >= player.cards.length) {
      this.sendError(playerId, 'Invalid card index');
      return;
    }

    const card = player.cards[cardIndex];
    if (card.revealed) {
      this.sendError(playerId, 'You can only flip a face-down card when discarding');
      return;
    }

    // Discard the drawn card
    this.state.discardPile.push(this.state.drawnCard);
    this.state.drawnCard = null;

    this.io.to(this.roomCode).emit('game:card-discarded', {
      discarded: this.state.discardPile[this.state.discardPile.length - 1],
      deckCount: this.state.deck.length,
      discardCount: this.state.discardPile.length
    });

    // Flip the chosen card
    card.revealed = true;

    this.io.to(this.roomCode).emit('game:card-flipped', {
      playerId,
      cardIndex,
      value: card.value
    });

    // Check for matching column
    this.checkAndClearColumn(player, cardIndex);

    // Check for round end or advance turn
    this.afterTurn(playerId);
    
    // Send full state update to ensure displays stay in sync
    this.io.to(this.roomCode).emit('game:state', this.state);
  }

  private checkAndClearColumn(player: Player, changedIndex: number): void {
    const col = changedIndex % GRID_COLS;
    const colIndices = [col, col + GRID_COLS, col + GRID_COLS * 2];
    const colCards = colIndices.map(i => player.cards[i]);

    // Check if all 3 cards in column are revealed and match
    if (colCards.every(c => c.revealed && !(c as any).cleared) && 
        colCards[0].value === colCards[1].value && 
        colCards[1].value === colCards[2].value) {
      
      // Add the cleared cards to discard pile (these go ON TOP)
      for (const idx of colIndices) {
        this.state.discardPile.push(player.cards[idx].value);
        (player.cards[idx] as any).cleared = true;
      }

      this.io.to(this.roomCode).emit('game:column-cleared', {
        playerId: player.id,
        column: col,
        clearedValue: colCards[0].value
      });
    }
  }

  private afterTurn(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId)!;
    
    // Check if this player revealed all their cards (triggers final round)
    const allRevealed = player.cards.every(c => c.revealed || (c as any).cleared);
    
    // Count only active players (not displays)
    const activePlayerCount = this.state.players.filter(p => !p.isDisplay).length;
    
    if (this.state.lastRoundTriggeredBy) {
      // We're in the final round
      this.state.turnsRemainingAfterTrigger--;
      if (this.state.turnsRemainingAfterTrigger <= 0) {
        // Add a small delay before ending round so players can see the final action
        setTimeout(() => this.endRound(), 750);
        return;
      }
    } else if (allRevealed) {
      // This player triggered the final round
      this.state.lastRoundTriggeredBy = playerId;
      this.state.turnsRemainingAfterTrigger = activePlayerCount - 1;
    }

    // Add a delay before advancing to next player so everyone can see the action
    setTimeout(() => this.advanceTurn(), 750);
  }

  private advanceTurn(): void {
    // Find next non-display player
    let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    let attempts = 0;
    while (this.state.players[nextIndex]?.isDisplay && attempts < this.state.players.length) {
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    }
    
    this.state.currentPlayerIndex = nextIndex;
    this.state.drawnCard = null;
    this.state.drawnFromDiscard = false;
    this.io.to(this.roomCode).emit('game:turn-update', {
      currentPlayerIndex: this.state.currentPlayerIndex,
      drawnCard: null
    });
  }

  private endRound(): void {
    // Reveal all cards
    for (const player of this.state.players) {
      for (const card of player.cards) {
        card.revealed = true;
      }
    }

    // Calculate scores
    const roundScores: Record<string, number> = {};
    for (const player of this.state.players) {
      let score = 0;
      for (const card of player.cards) {
        if (!(card as any).cleared) {
          score += card.value;
        }
      }
      
      // Penalty: if you triggered the round but don't have lowest score, double POSITIVE points only
      // This rule only applies to positive points (not negative/zero)
      const triggeredPlayer = this.state.lastRoundTriggeredBy;
      if (triggeredPlayer === player.id && score > 0) {
        const otherScores = this.state.players
          .filter(p => p.id !== player.id && !p.isDisplay)
          .map(p => p.cards.filter(c => !(c as any).cleared).reduce((sum, c) => sum + c.value, 0));
        
        if (otherScores.some(s => s <= score)) {
          score *= 2;
        }
      }

      roundScores[player.id] = score;
      player.score += score;
      this.state.roundScores[player.id].push(score);
    }

    // Check for game over
    const maxScore = Math.max(...this.state.players.map(p => p.score));
    if (maxScore >= WINNING_SCORE) {
      const winner = this.state.players.reduce((a, b) => a.score < b.score ? a : b);
      this.state.winner = winner.id;
      this.state.phase = 'game-over';
      
      const finalScores: Record<string, number> = {};
      this.state.players.forEach(p => finalScores[p.id] = p.score);

      this.io.to(this.roomCode).emit('game:game-over', {
        winner: winner.id,
        finalScores
      });
    } else {
      // Keep phase as 'round-end' for the overlay, then transition to lobby
      this.state.phase = 'round-end';
      
      this.io.to(this.roomCode).emit('game:round-ended', {
        scores: roundScores,
        triggeredBy: this.state.lastRoundTriggeredBy!
      });
    }
    
    // Always send full game state so clients get all revealed cards
    this.io.to(this.roomCode).emit('game:state', this.state);
  }

  // Called from round-end overlay - transitions to lobby
  goToLobby(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player?.isHost) {
      this.sendError(playerId, 'Only the host can do this');
      return;
    }
    if (this.state.phase !== 'round-end') {
      this.sendError(playerId, 'Not in round-end phase');
      return;
    }

    this.state.phase = 'waiting';
    this.io.to(this.roomCode).emit('game:state', this.state);
  }

  // Called from lobby - starts the next round
  startNextRound(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player?.isHost) {
      this.sendError(playerId, 'Only the host can start the next round');
      return;
    }
    if (this.state.phase !== 'waiting' || this.state.roundNumber === 0) {
      this.sendError(playerId, 'Cannot start next round');
      return;
    }

    this.state.roundNumber++;
    this.initializeRound();
    this.state.phase = 'initial-flip';

    // Each player needs to flip 2 cards
    this.state.players.forEach(p => {
      this.initialFlipsRemaining.set(p.id, 2);
    });

    this.io.to(this.roomCode).emit('game:state', this.state);
  }

  endGame(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player?.isHost) {
      this.sendError(playerId, 'Only the host can end the game');
      return;
    }

    // Reset all game state
    this.state.roundNumber = 0;
    this.state.phase = 'waiting';
    this.state.winner = null;
    this.state.lastRoundTriggeredBy = null;
    this.state.turnsRemainingAfterTrigger = 0;
    this.state.deck = [];
    this.state.discardPile = [];
    this.state.drawnCard = null;
    this.state.drawnFromDiscard = false;

    // Reset player scores and cards
    for (const p of this.state.players) {
      p.score = 0;
      p.cards = [];
      this.state.roundScores[p.id] = [];
    }

    this.io.to(this.roomCode).emit('game:state', this.state);
  }

  private isPlayerTurn(playerId: string): boolean {
    if (this.state.phase !== 'playing') return false;
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    return currentPlayer?.id === playerId;
  }

  private sendError(playerId: string, message: string): void {
    const socket = this.playerSockets.get(playerId);
    if (socket) {
      socket.emit('error', message);
    }
  }
}

