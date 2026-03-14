import { useGameStore } from '../store';
import { Card } from './Card';
import styles from './Display.module.css';

// Calculate current known score from revealed cards
function calculateVisibleScore(cards: { value: number; revealed: boolean; cleared?: boolean }[]): number {
  return cards
    .filter(c => c.revealed && !c.cleared)
    .reduce((sum, c) => sum + c.value, 0);
}

export function Display() {
  const { gameState, roomCode, players } = useGameStore();

  const handleLeave = () => {
    useGameStore.getState().clearSession();
  };

  // Use players from store (updated on join) or gameState.players
  const currentPlayers = gameState?.players || players;
  const hasHost = currentPlayers.some(p => p.isHost);

  // Waiting for game to start
  if (!gameState || gameState.phase === 'waiting') {
    return (
      <div className={styles.container}>
        <div className={styles.waitingScreen}>
          <h1 className={styles.title}>
            <span className={styles.sky}>Sky</span>
            <span className={styles.jo}>Jo</span>
          </h1>
          <div className={styles.codeDisplay}>
            <p className={styles.codeLabel}>Join with code</p>
            <div className={styles.code}>{roomCode}</div>
          </div>
          
          <div className={styles.playerList}>
            {currentPlayers.length === 0 ? (
              <p className={styles.noPlayers}>No players yet...</p>
            ) : (
              currentPlayers.map(p => (
                <div key={p.id} className={styles.playerPill}>
                  {p.name}
                  {p.isHost && <span className={styles.hostBadge}>HOST</span>}
                </div>
              ))
            )}
          </div>
          
          <p className={styles.waitingText}>
            {!hasHost 
              ? 'Waiting for a host to join...'
              : `${currentPlayers.length} player${currentPlayers.length !== 1 ? 's' : ''} · Waiting for host to start`
            }
          </p>
          <button className={styles.leaveBtn} onClick={handleLeave}>
            ✕ Close Display
          </button>
        </div>
      </div>
    );
  }

  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
  const activePlayers = gameState.players.filter(p => !p.isDisplay);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.roomInfo}>
          <span className={styles.roomCode}>{gameState.roomCode}</span>
          <span className={styles.roundInfo}>Round {gameState.roundNumber}</span>
        </div>
        
        {gameState.phase === 'playing' && (
          <div className={styles.turnIndicator}>
            <span className={styles.turnLabel}>Current Turn:</span>
            <span className={styles.turnPlayer}>{currentTurnPlayer?.name}</span>
          </div>
        )}

        {gameState.phase === 'round-end' && (
          <div className={styles.phaseIndicator}>Round Complete!</div>
        )}

        {gameState.phase === 'game-over' && (
          <div className={styles.phaseIndicator}>
            🏆 {gameState.players.find(p => p.id === gameState.winner)?.name} Wins!
          </div>
        )}
      </div>

      {/* All players grid */}
      <div className={styles.playersGrid}>
        {activePlayers.map(player => {
          const visibleScore = calculateVisibleScore(player.cards as any);
          const isCurrentTurn = player.id === currentTurnPlayer?.id;
          
          return (
            <div 
              key={player.id}
              className={`${styles.playerBoard} ${isCurrentTurn ? styles.currentTurn : ''}`}
            >
              <div className={styles.playerHeader}>
                <span className={styles.playerName}>
                  <span className={styles.playerAvatar}>{player.avatar}</span>
                  {player.name}
                  {isCurrentTurn && <span className={styles.turnBadge}>TURN</span>}
                </span>
                <div className={styles.playerScores}>
                  <span className={styles.visibleScore}>{visibleScore} pts</span>
                  {player.score > 0 && (
                    <span className={styles.totalScore}>Total: {player.score}</span>
                  )}
                </div>
              </div>
              <div className={styles.cardGrid}>
                {player.cards.map((card) => (
                  <Card
                    key={card.id}
                    value={card.value}
                    revealed={card.revealed}
                    cleared={(card as any).cleared}
                    size="small"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deck, Drawn Card, and Discard pile preview */}
      <div className={styles.pilesArea}>
        <div className={styles.pileContainer}>
          <span className={styles.pileLabel}>Deck</span>
          <Card revealed={false} size="normal" />
          <span className={styles.pileCount}>{gameState.deck.length}</span>
        </div>
        
        {/* Drawn card - show when a player has drawn */}
        <div className={styles.pileContainer}>
          <span className={styles.pileLabel}>
            {gameState.drawnCard !== null ? `${currentTurnPlayer?.name}'s Card` : 'Drawn'}
          </span>
          {gameState.drawnCard !== null ? (
            <Card 
              value={gameState.drawnCard} 
              revealed={true} 
              size="normal" 
              isDrawn={true}
            />
          ) : (
            <div className={styles.emptyPile}>—</div>
          )}
        </div>
        
        <div className={styles.pileContainer}>
          <span className={styles.pileLabel}>Discard</span>
          {gameState.discardPile.length > 0 ? (
            <Card 
              value={gameState.discardPile[gameState.discardPile.length - 1]} 
              revealed={true} 
              size="normal" 
            />
          ) : (
            <div className={styles.emptyPile}>Empty</div>
          )}
          <span className={styles.pileCount}>{gameState.discardPile.length}</span>
        </div>
      </div>

      {/* Scoreboard overlay for round-end/game-over */}
      {(gameState.phase === 'round-end' || gameState.phase === 'game-over') && (
        <div className={styles.scoreOverlay}>
          <div className={styles.scoreBoard}>
            <h2>{gameState.phase === 'game-over' ? '🏆 Final Scores' : '📊 Round Scores'}</h2>
            <div className={styles.scoreList}>
              {[...activePlayers]
                .sort((a, b) => a.score - b.score)
                .map((player, rank) => (
                  <div key={player.id} className={styles.scoreRow}>
                    <span className={styles.rank}>#{rank + 1}</span>
                    <span className={styles.scoreName}>{player.name}</span>
                    <span className={styles.scoreValue}>{player.score}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

