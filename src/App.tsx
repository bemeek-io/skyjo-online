import { useEffect } from 'react';
import { socket } from './socket';
import { useGameStore } from './store';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { Display } from './components/Display';
import { Toast } from './components/Toast';
import { MusicPlayer } from './components/MusicPlayer';
import { playSound, initAudio } from './sounds';

function App() {
  const { 
    view, 
    setView,
    setConnected, 
    setPlayers, 
    addPlayer,
    updatePlayerConnection,
    setPlayerInfo,
    setGameState,
    setDrawnCard,
    setError,
    playerId,
    roomCode,
  } = useGameStore();

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      
      // Try to rejoin if we have session data
      if (playerId && roomCode) {
        socket.emit('room:rejoin', roomCode, playerId, (response) => {
          if (!response.success) {
            useGameStore.getState().clearSession();
          }
        });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room:joined', (data) => {
      setPlayerInfo(data.playerId, data.roomCode);
      setPlayers(data.players);
      setView('lobby');
    });

    socket.on('room:player-joined', (player) => {
      addPlayer(player);
    });

    socket.on('room:avatar-changed', ({ playerId: pid, avatar }) => {
      useGameStore.getState().updatePlayerAvatar(pid, avatar);
    });

    socket.on('room:player-left', (id) => {
      updatePlayerConnection(id, false);
    });

    socket.on('room:player-reconnected', (id) => {
      updatePlayerConnection(id, true);
    });

    socket.on('room:closed', () => {
      useGameStore.getState().clearSession();
    });

    socket.on('room:kicked', () => {
      useGameStore.getState().setError('You were kicked from the game');
      useGameStore.getState().clearSession();
    });

    socket.on('game:state', (state) => {
      // Check if last round was just triggered (transition from null to a value)
      const prevState = useGameStore.getState().gameState;
      const wasTriggered = !prevState?.lastRoundTriggeredBy && state.lastRoundTriggeredBy;
      if (wasTriggered) {
        playSound('lastRoundTrigger');
      }
      
      setGameState(state);
      // Also sync players array (for lobby view and host updates)
      setPlayers(state.players);
      
      // Sync drawnCard if it's our turn and we have a drawn card
      const myId = useGameStore.getState().playerId;
      const isMyTurn = state.players[state.currentPlayerIndex]?.id === myId;
      if (isMyTurn && state.drawnCard !== null) {
        setDrawnCard(state.drawnCard);
        useGameStore.getState().setDrawnFromDiscard(state.drawnFromDiscard || false);
      } else if (!isMyTurn) {
        // Clear drawn card if it's not our turn
        setDrawnCard(null);
      }
      
      const currentView = useGameStore.getState().view;
      // Don't change view if we're in display mode
      if (currentView !== 'display') {
        if (state.phase === 'waiting') {
          // Go to lobby (between rounds or game end)
          setView('lobby');
        } else {
          setView('game');
        }
      }
    });

    socket.on('game:started', (state) => {
      setGameState(state);
      const currentView = useGameStore.getState().view;
      if (currentView !== 'display') {
        setView('game');
      }
    });

    socket.on('game:card-flipped', ({ playerId: pid, cardIndex, value }) => {
      playSound('cardFlip');
      
      setGameState(prev => {
        if (!prev) return prev;
        const players = prev.players.map(p => {
          if (p.id === pid) {
            const cards = [...p.cards];
            cards[cardIndex] = { ...cards[cardIndex], revealed: true, value };
            return { ...p, cards };
          }
          return p;
        });
        return { ...prev, players };
      });
    });

    socket.on('game:turn-update', ({ currentPlayerIndex, drawnCard }) => {
      setGameState(prev => prev ? { ...prev, currentPlayerIndex, drawnCard } : prev);
      setDrawnCard(drawnCard);
    });

    socket.on('game:card-drawn', ({ fromDiscard, card, playerId: drawingPlayerId }) => {
      playSound('cardDraw');
      
      // Track the current turn's drawn card (visible to everyone)
      useGameStore.getState().setCurrentTurnDraw(card, drawingPlayerId, fromDiscard);
      
      // Also update local drawnCard if it's our turn
      const myId = useGameStore.getState().playerId;
      if (drawingPlayerId === myId && card !== null) {
        setDrawnCard(card);
        useGameStore.getState().setDrawnFromDiscard(fromDiscard);
      }
    });

    socket.on('game:card-swapped', () => {
      playSound('cardSwap');
      
      // Clear the current turn's drawn card
      useGameStore.getState().setCurrentTurnDraw(null, null, false);
      
      // Full state sync comes from game:state event
      setDrawnCard(null);
      useGameStore.getState().setDrawnFromDiscard(false);
    });

    socket.on('game:card-discarded', () => {
      // Clear the current turn's drawn card
      useGameStore.getState().setCurrentTurnDraw(null, null, false);
      
      // Full state sync comes from game:state event
      setDrawnCard(null);
      useGameStore.getState().setDrawnFromDiscard(false);
    });

    socket.on('game:column-cleared', ({ playerId: pid, column }) => {
      playSound('columnClear');
      
      setGameState(prev => {
        if (!prev) return prev;
        const players = prev.players.map(p => {
          if (p.id === pid) {
            const cards = p.cards.map((c, i) => {
              if (i % 4 === column) {
                return { ...c, cleared: true } as any;
              }
              return c;
            });
            return { ...p, cards };
          }
          return p;
        });
        return { ...prev, players };
      });
    });

    socket.on('game:round-ended', ({ scores, triggeredBy }) => {
      playSound('roundEnd');
      
      setGameState(prev => {
        if (!prev) return prev;
        const players = prev.players.map(p => ({
          ...p,
          score: p.score + (scores[p.id] || 0),
          cards: p.cards.map(c => ({ ...c, revealed: true }))
        }));
        return { ...prev, players, phase: 'round-end', lastRoundTriggeredBy: triggeredBy };
      });
    });

    socket.on('game:game-over', ({ winner, finalScores }) => {
      playSound('gameOver');
      
      setGameState(prev => {
        if (!prev) return prev;
        const players = prev.players.map(p => ({
          ...p,
          score: finalScores[p.id] || p.score
        }));
        return { ...prev, players, phase: 'game-over', winner };
      });
    });

    socket.on('error', (message) => {
      playSound('error');
      setError(message);
    });
    
    // Handle reactions
    socket.on('game:reaction', ({ playerId: reactingPlayerId, emoji }) => {
      playSound('reaction');
      useGameStore.getState().addReaction(reactingPlayerId, emoji);
    });
    
    // Play turn start sound when it becomes our turn
    socket.on('game:turn-update', ({ currentPlayerIndex }) => {
      const state = useGameStore.getState();
      const isMyTurn = state.gameState?.players[currentPlayerIndex]?.id === state.playerId;
      if (isMyTurn) {
        playSound('turnStart');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:joined');
      socket.off('room:player-joined');
      socket.off('room:avatar-changed');
      socket.off('room:player-left');
      socket.off('room:player-reconnected');
      socket.off('room:closed');
      socket.off('room:kicked');
      socket.off('game:state');
      socket.off('game:started');
      socket.off('game:card-flipped');
      socket.off('game:turn-update');
      socket.off('game:card-drawn');
      socket.off('game:card-swapped');
      socket.off('game:card-discarded');
      socket.off('game:column-cleared');
      socket.off('game:round-ended');
      socket.off('game:game-over');
      socket.off('error');
      socket.off('game:reaction');
    };
  }, []);
  
  // Initialize audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  return (
    <>
      <Toast />
      <MusicPlayer />
      {view === 'home' && <Home />}
      {view === 'lobby' && <Lobby />}
      {view === 'game' && <Game />}
      {view === 'display' && <Display />}
    </>
  );
}

export default App;

