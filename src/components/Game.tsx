import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store';
import { Card } from './Card';
import { calculateAchievements, getPlayerAchievement } from '../achievements';
import type { ReactionEmoji } from '../../shared/types';
import styles from './Game.module.css';

// Reaction emojis available
const REACTIONS: ReactionEmoji[] = ['👍', '😮', '😭', '🎉', '🔥', '😂'];

// Calculate current known score from revealed cards
function calculateVisibleScore(cards: { value: number; revealed: boolean; cleared?: boolean }[]): number {
  return cards
    .filter(c => c.revealed && !c.cleared)
    .reduce((sum, c) => sum + c.value, 0);
}

export function Game() {
  const { gameState, playerId, drawnCard, drawnFromDiscard, reactions, currentTurnDrawnCard, currentTurnDrawnBy, currentTurnFromDiscard } = useGameStore();
  const [discardMode, setDiscardMode] = useState(false); // When true, clicking a hidden card will discard+flip
  const [showScoreboard, setShowScoreboard] = useState(false); // Scoreboard modal
  const [showReactions, setShowReactions] = useState(false); // Reaction picker
  const [showRoundResults, setShowRoundResults] = useState(false); // Show round results overlay vs final board
  
  // Auto-remove old reactions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      reactions.forEach(r => {
        if (now - r.timestamp > 3000) {
          useGameStore.getState().removeReaction(r.id);
        }
      });
    }, 500);
    return () => clearInterval(interval);
  }, [reactions]);
  
  // Reset showRoundResults when phase changes to playing (new round)
  useEffect(() => {
    if (gameState?.phase === 'playing' || gameState?.phase === 'initial-flip') {
      setShowRoundResults(false);
    }
  }, [gameState?.phase]);
  
  const handleReaction = (emoji: ReactionEmoji) => {
    socket.emit('game:reaction', emoji);
    // Don't close the menu - let user send multiple reactions
  };
  
  
  // Generate random positioning for each reaction emoji
  const getReactionProps = (reactionId: string) => {
    // Use reaction id to seed consistent random values
    const hash = reactionId.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999) * 10000;
      return Math.abs(x) % 1;
    };
    
    const isLeft = hash % 2 === 0;
    const startBottom = 10 + seededRandom(hash + 1) * 15; // 10-25% from bottom
    const horizontalPos = 0.5 + seededRandom(hash + 2) * 2.5; // 0.5-3rem from edge
    const animationDuration = 4 + seededRandom(hash + 3) * 2; // 4-6 seconds
    
    return {
      className: isLeft ? styles.floatingEmojiLeft : styles.floatingEmojiRight,
      style: {
        [isLeft ? 'left' : 'right']: `${horizontalPos}rem`,
        bottom: `${startBottom}%`,
        animationDuration: `${animationDuration}s`,
      }
    };
  };

  if (!gameState) return null;

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
  const otherPlayers = gameState.players.filter(p => p.id !== playerId);
  
  // Find the player to display: current turn player, or if it's my turn, the next player
  const getDisplayPlayer = () => {
    if (!isMyTurn) {
      // Show the current turn player
      return currentTurnPlayer;
    }
    // It's my turn - show the next player after me
    const myIndex = gameState.players.findIndex(p => p.id === playerId);
    const nextIndex = (myIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextIndex];
    // If next player is also me (only 1 player), return null
    if (nextPlayer?.id === playerId) return otherPlayers[0] || null;
    return nextPlayer;
  };
  const displayPlayer = getDisplayPlayer();

  const topDiscard = gameState.discardPile[gameState.discardPile.length - 1];
  
  // Get player who drew the current turn's card
  const currentTurnDrawnPlayer = currentTurnDrawnBy 
    ? gameState.players.find(p => p.id === currentTurnDrawnBy) 
    : null;
  
  // Calculate visible scores
  const myVisibleScore = currentPlayer ? calculateVisibleScore(currentPlayer.cards as any) : 0;

  const handleLeaveGame = () => {
    socket.emit('room:leave');
    useGameStore.getState().clearSession();
  };

  const handleKick = (targetPlayerId: string) => {
    socket.emit('room:kick', targetPlayerId);
  };

  const handleFlipInitial = (cardIndex: number) => {
    socket.emit('game:flip-initial', cardIndex);
  };

  const handleDrawFromDeck = () => {
    socket.emit('game:draw-card', false);
  };

  const handleDrawFromDiscard = () => {
    socket.emit('game:draw-card', true);
  };

  const handleCardClick = (cardIndex: number) => {
    if (gameState.phase === 'initial-flip') {
      const card = currentPlayer?.cards[cardIndex];
      if (card && !card.revealed) {
        const revealedCount = currentPlayer?.cards.filter(c => c.revealed).length || 0;
        if (revealedCount < 2) {
          handleFlipInitial(cardIndex);
        }
      }
      return;
    }

    if (!isMyTurn || gameState.phase !== 'playing') return;

    const card = currentPlayer?.cards[cardIndex];
    if (!card) return;

    if (drawnCard !== null) {
      if (discardMode && !card.revealed) {
        // Discard the drawn card and flip this hidden card
        socket.emit('game:discard-drawn', cardIndex);
        setDiscardMode(false);
      } else {
        // Swap the drawn card with this card
        socket.emit('game:swap-card', cardIndex);
        setDiscardMode(false);
      }
    }
  };

  const handleToggleDiscardMode = () => {
    setDiscardMode(!discardMode);
  };

  const handleGoToLobby = () => {
    socket.emit('game:go-to-lobby');
  };

  const getPhaseMessage = () => {
    if (gameState.phase === 'initial-flip') {
      const revealedCount = currentPlayer?.cards.filter(c => c.revealed).length || 0;
      if (revealedCount < 2) {
        return `Tap ${2 - revealedCount} card${2 - revealedCount > 1 ? 's' : ''} to flip`;
      }
      return 'Waiting for others...';
    }

    if (gameState.phase === 'round-end') {
      return 'Round Over!';
    }

    if (gameState.phase === 'game-over') {
      const winner = gameState.players.find(p => p.id === gameState.winner);
      return `${winner?.name} wins!`;
    }

    if (isMyTurn) {
      if (drawnCard === null) {
        return 'Draw from deck or discard';
      }
      if (drawnFromDiscard) {
        return 'Tap a card to swap';
      }
      // Drew from deck - can swap or discard+flip
      if (discardMode) {
        return 'Tap a hidden card to flip (discarding drawn card)';
      }
      return 'Tap a card to swap, or tap "Discard" to flip instead';
    }

    return `${currentTurnPlayer?.name}'s turn`;
  };

  const isLastRound = gameState.lastRoundTriggeredBy !== null;
  const lastRoundTriggerPlayer = isLastRound 
    ? gameState.players.find(p => p.id === gameState.lastRoundTriggeredBy)
    : null;

  const canClickCard = (cardIndex: number) => {
    if (gameState.phase === 'initial-flip') {
      const card = currentPlayer?.cards[cardIndex];
      if (!card?.revealed) {
        const revealedCount = currentPlayer?.cards.filter(c => c.revealed).length || 0;
        return revealedCount < 2;
      }
      return false;
    }

    if (!isMyTurn || gameState.phase !== 'playing') return false;
    if (drawnCard === null) return false;
    
    const card = currentPlayer?.cards[cardIndex];
    if (!card) return false;
    
    // In discard mode, can only click hidden cards
    if (discardMode) {
      return !card.revealed;
    }
    
    return true;
  };

  // Render a single player's board
  const renderPlayerBoard = (player: typeof otherPlayers[0]) => {
    const playerVisibleScore = calculateVisibleScore(player.cards as any);
    const isTheirTurn = gameState.players[gameState.currentPlayerIndex]?.id === player.id;
    
    return (
      <div 
        key={player.id} 
        className={`${styles.otherPlayer} ${isTheirTurn ? styles.active : ''} ${!player.connected ? styles.disconnected : ''}`}
      >
        <div className={styles.otherPlayerHeader}>
          <div className={styles.otherPlayerInfo}>
            <span className={styles.playerAvatar}>{player.avatar || player.name.charAt(0).toUpperCase()}</span>
            <span className={styles.otherPlayerName}>
              {player.name}
              {isTheirTurn && <span className={styles.turnDot}>●</span>}
            </span>
          </div>
          <span className={styles.otherPlayerScore}>
            {playerVisibleScore} pts
            {player.score > 0 && <span className={styles.totalScore}> (+{player.score})</span>}
          </span>
        </div>
        
        <div className={styles.otherPlayerGrid}>
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
  };

  return (
    <div className={`${styles.container} ${isMyTurn ? styles.myTurnContainer : ''}`}>
      {/* Global floating reactions */}
      {reactions.length > 0 && (
        <div className={styles.globalReactions}>
          {reactions.map((r) => {
            const props = getReactionProps(r.id);
            return (
              <span 
                key={r.id} 
                className={`${styles.floatingEmoji} ${props.className}`}
                style={props.style}
              >
                {r.emoji}
              </span>
            );
          })}
        </div>
      )}

      {/* Turn indicator banner */}
      {isMyTurn && gameState.phase === 'playing' && (
        <div className={styles.turnBanner}>
          YOUR TURN
        </div>
      )}

      {/* Last round indicator */}
      {isLastRound && gameState.phase === 'playing' && (
        <div className={styles.lastRoundBanner}>
          ⚠️ FINAL ROUND — {lastRoundTriggerPlayer?.name} revealed all cards!
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.exitBtn} onClick={handleLeaveGame}>
          ✕ Exit
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.roomCode}>{gameState.roomCode}</div>
          <div className={styles.roundInfo}>Round {gameState.roundNumber}</div>
        </div>
        <button className={styles.scoreboardBtn} onClick={() => setShowScoreboard(true)}>
          🏆
        </button>
      </div>

      {/* Phase message */}
      <div className={`${styles.phaseMessage} ${isMyTurn ? styles.myTurnMessage : ''}`}>
        {getPhaseMessage()}
      </div>

      {/* Other players section */}
      {otherPlayers.length > 0 && (
        <div className={styles.otherPlayersSection}>
          {/* Mobile: show current turn player (or next player if it's my turn) */}
          <div className={styles.mobileView}>
            {displayPlayer && displayPlayer.id !== playerId && renderPlayerBoard(displayPlayer)}
          </div>

          {/* Desktop: show all players */}
          <div className={styles.desktopGrid}>
            {otherPlayers.map(player => renderPlayerBoard(player))}
          </div>
        </div>
      )}

      {/* Center area - deck and discard */}
      <div className={styles.centerArea}>
        <div className={styles.piles}>
          {/* Deck */}
          <div 
            className={`${styles.pile} ${isMyTurn && drawnCard === null && gameState.phase === 'playing' ? styles.clickable : ''}`}
            onClick={isMyTurn && drawnCard === null && gameState.phase === 'playing' ? handleDrawFromDeck : undefined}
          >
            <div className={styles.pileLabel}>Deck</div>
            <Card revealed={false} size="large" />
            <div className={styles.pileCount}>{gameState.deck.length}</div>
          </div>

          {/* Drawn card area - shows current player's drawn card to everyone */}
          <div className={styles.drawnCardArea}>
            {currentTurnDrawnCard !== null ? (
              <>
                <div className={styles.drawnLabel}>
                  {isMyTurn ? 'Your card' : `${currentTurnDrawnPlayer?.name || 'Player'}'s card`}
                </div>
                <Card 
                  value={currentTurnDrawnCard} 
                  revealed={true} 
                  size="large" 
                  isDrawn={isMyTurn}
                />
                {/* Discard button - only show when it's my turn */}
                {isMyTurn ? (
                  <button 
                    className={`${styles.discardBtn} ${discardMode ? styles.discardBtnActive : ''} ${currentTurnFromDiscard ? styles.discardBtnHidden : ''}`}
                    onClick={handleToggleDiscardMode}
                    disabled={currentTurnFromDiscard}
                  >
                    {discardMode ? '✕ Cancel' : '🗑️ Discard & Flip'}
                  </button>
                ) : (
                  <div className={styles.buttonPlaceholder} />
                )}
              </>
            ) : (
              /* Placeholder to reserve space */
              <div className={styles.drawnCardPlaceholder}>
                <div className={styles.drawnLabel}>&nbsp;</div>
                <div className={styles.cardPlaceholder} />
                <div className={styles.buttonPlaceholder} />
              </div>
            )}
          </div>

          {/* Discard pile */}
          <div 
            className={`${styles.pile} ${isMyTurn && drawnCard === null && gameState.phase === 'playing' && topDiscard !== undefined ? styles.clickable : ''}`}
            onClick={isMyTurn && drawnCard === null && gameState.phase === 'playing' && topDiscard !== undefined ? handleDrawFromDiscard : undefined}
          >
            <div className={styles.pileLabel}>Discard</div>
            {topDiscard !== undefined ? (
              <Card value={topDiscard} revealed={true} size="large" />
            ) : (
              <div className={styles.emptyPile}>Empty</div>
            )}
            <div className={styles.pileCount}>{gameState.discardPile.length}</div>
          </div>
        </div>
      </div>

      {/* Current player's grid */}
      <div className={`${styles.myArea} ${isMyTurn ? styles.myTurnArea : ''}`}>
        <div className={styles.myHeader}>
          <div className={styles.myInfo}>
            <span className={styles.myAvatar}>{currentPlayer?.avatar || currentPlayer?.name.charAt(0).toUpperCase()}</span>
            <span className={styles.myName}>
              {currentPlayer?.name} (You)
              <span className={`${styles.myTurnBadge} ${!isMyTurn ? styles.hidden : ''}`}>YOUR TURN</span>
            </span>
          </div>
          <div className={styles.myScoreArea}>
            <span className={styles.myVisibleScore}>{myVisibleScore} pts</span>
            {(currentPlayer?.score || 0) > 0 && (
              <span className={styles.myTotalScore}>Total: {currentPlayer?.score}</span>
            )}
          </div>
        </div>
        <div className={styles.myGrid}>
          {currentPlayer?.cards.map((card, i) => (
            <Card
              key={card.id}
              value={card.value}
              revealed={card.revealed}
              cleared={(card as any).cleared}
              onClick={() => handleCardClick(i)}
              disabled={!canClickCard(i)}
              highlight={canClickCard(i)}
              size="normal"
            />
          ))}
        </div>
      </div>

      {/* Scoreboard modal */}
      {showScoreboard && (
        <div className={styles.scoreboardOverlay} onClick={() => setShowScoreboard(false)}>
          <div className={styles.scoreboardModal} onClick={e => e.stopPropagation()}>
            <div className={styles.scoreboardHeader}>
              <h3>🏆 Scoreboard</h3>
              <button className={styles.closeBtn} onClick={() => setShowScoreboard(false)}>✕</button>
            </div>
            <div className={styles.scoreboardList}>
              {[...gameState.players]
                .filter(p => !p.isDisplay)
                .sort((a, b) => a.score - b.score)
                .map((player, rank) => {
                  const visibleScore = calculateVisibleScore(player.cards as any);
                  const isCurrentTurn = gameState.players[gameState.currentPlayerIndex]?.id === player.id;
                  
                  return (
                    <div 
                      key={player.id}
                      className={`${styles.scoreboardRow} ${player.id === playerId ? styles.myScoreboardRow : ''} ${isCurrentTurn ? styles.currentTurnRow : ''}`}
                    >
                      <span className={styles.scoreboardRank}>#{rank + 1}</span>
                      <span className={styles.scoreboardAvatar}>{player.avatar || player.name.charAt(0).toUpperCase()}</span>
                      <div className={styles.scoreboardInfo}>
                        <span className={styles.scoreboardName}>
                          {player.name}
                          {player.id === playerId && <span className={styles.youBadge}>You</span>}
                          {isCurrentTurn && <span className={styles.turnBadge}>●</span>}
                          {!player.connected && <span className={styles.disconnectedBadge}>Disconnected</span>}
                        </span>
                        <span className={styles.scoreboardGameTotal}>
                          Total: {player.score}
                        </span>
                      </div>
                      <span className={styles.scoreboardRoundScore}>{visibleScore >= 0 ? '+' : ''}{visibleScore}</span>
                      {/* Host can kick other players */}
                      {currentPlayer?.isHost && player.id !== playerId && (
                        <button 
                          className={styles.scoreboardKickBtn}
                          onClick={() => handleKick(player.id)}
                          title="Kick player"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
            <div className={styles.scoreboardFooter}>
              <span className={styles.scoreboardHint}>First to {100} loses • Lower is better</span>
            </div>
          </div>
        </div>
      )}

      {/* Reaction bar - only show during active gameplay, not round-end */}
      {(gameState.phase === 'playing' || gameState.phase === 'initial-flip') && (
        <>
          {/* Invisible overlay to close reaction picker when clicking outside */}
          {showReactions && (
            <div 
              className={styles.reactionOverlay} 
              onClick={() => setShowReactions(false)}
            />
          )}
          <div className={styles.reactionBar}>
            <button 
              className={styles.reactionToggle}
              onClick={() => setShowReactions(!showReactions)}
            >
              {showReactions ? '✕' : '😊'}
            </button>
            {showReactions && (
              <div className={styles.reactionPicker}>
                {REACTIONS.map(emoji => (
                  <button 
                    key={emoji}
                    className={styles.reactionBtn}
                    onClick={() => handleReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Final board overlay - show before round results */}
      {(gameState.phase === 'round-end' || gameState.phase === 'game-over') && !showRoundResults && (
        <div className={styles.finalBoardOverlay} onClick={() => setShowRoundResults(true)}>
          <div className={styles.finalBoardBanner}>
            <h2>{gameState.phase === 'game-over' ? 'Game Over!' : 'Round Over!'}</h2>
            <p>Your final score: {currentPlayer?.cards.filter(c => !(c as any).cleared).reduce((sum, c) => sum + c.value, 0)} pts</p>
            <button className={styles.continueBtn}>
              See Results →
            </button>
          </div>
        </div>
      )}

      {/* Round end / Game over overlay */}
      {(gameState.phase === 'round-end' || gameState.phase === 'game-over') && showRoundResults && (() => {
        const sortedPlayers = [...gameState.players]
          .filter(p => !p.isDisplay)
          .sort((a, b) => {
            // Sort by round score for this round
            const aScore = a.cards.filter(c => !(c as any).cleared).reduce((sum, c) => sum + c.value, 0);
            const bScore = b.cards.filter(c => !(c as any).cleared).reduce((sum, c) => sum + c.value, 0);
            return aScore - bScore;
          });
        
        const top3 = sortedPlayers.slice(0, 3);
        const achievements = calculateAchievements(gameState.players, gameState.lastRoundTriggeredBy);
        
        return (
          <div className={styles.overlay}>
            <div className={styles.overlayContent}>
              <h2>{gameState.phase === 'game-over' ? '🏆 Game Over!' : 'Round Complete'}</h2>
              
              {/* Podium for top 3 */}
              <div className={styles.podium}>
                {/* 2nd place */}
                {top3[1] && (
                  <div className={`${styles.podiumSpot} ${styles.podiumSecond}`}>
                    <div className={styles.podiumAvatar}>{top3[1].avatar}</div>
                    <div className={styles.podiumName}>{top3[1].name}</div>
                    <div className={styles.podiumScore}>
                      {top3[1].cards.filter(c => !(c as any).cleared).reduce((sum, c) => sum + c.value, 0)} pts
                    </div>
                    <div className={styles.podiumBase}>2</div>
                  </div>
                )}
                
                {/* 1st place */}
                {top3[0] && (
                  <div className={`${styles.podiumSpot} ${styles.podiumFirst}`}>
                    <div className={styles.podiumCrown}>👑</div>
                    <div className={styles.podiumAvatar}>{top3[0].avatar}</div>
                    <div className={styles.podiumName}>{top3[0].name}</div>
                    <div className={styles.podiumScore}>
                      {top3[0].cards.filter(c => !(c as any).cleared).reduce((sum, c) => sum + c.value, 0)} pts
                    </div>
                    <div className={styles.podiumBase}>1</div>
                  </div>
                )}
                
                {/* 3rd place */}
                {top3[2] && (
                  <div className={`${styles.podiumSpot} ${styles.podiumThird}`}>
                    <div className={styles.podiumAvatar}>{top3[2].avatar}</div>
                    <div className={styles.podiumName}>{top3[2].name}</div>
                    <div className={styles.podiumScore}>
                      {top3[2].cards.filter(c => !(c as any).cleared).reduce((sum, c) => sum + c.value, 0)} pts
                    </div>
                    <div className={styles.podiumBase}>3</div>
                  </div>
                )}
              </div>

              {/* Personal Achievement - show the current player's achievement prominently */}
              {(() => {
                const myAchievement = getPlayerAchievement(achievements, playerId || '');
                if (!myAchievement) return null;
                
                return (
                  <div className={styles.personalAchievement}>
                    <div className={styles.personalAchievementEmoji}>{myAchievement.emoji}</div>
                    <div className={styles.personalAchievementTitle}>{myAchievement.name}</div>
                    <div className={styles.personalAchievementDesc}>{myAchievement.description}</div>
                  </div>
                );
              })()}

              {/* Total scores */}
              <div className={styles.totalScores}>
                <h3>Total Scores</h3>
                <div className={styles.scoreBoard}>
                  {[...gameState.players]
                    .filter(p => !p.isDisplay)
                    .sort((a, b) => a.score - b.score)
                    .map((player, rank) => (
                      <div 
                        key={player.id} 
                        className={`${styles.scoreRow} ${player.id === playerId ? styles.myRow : ''}`}
                      >
                        <span className={styles.rank}>#{rank + 1}</span>
                        <span className={styles.scoreAvatar}>{player.avatar || player.name.charAt(0).toUpperCase()}</span>
                        <span className={styles.scoreName}>
                          {player.name}
                          {player.id === gameState.lastRoundTriggeredBy && (
                            <span className={styles.triggered}>Ended round</span>
                          )}
                        </span>
                        <span className={styles.scoreValue}>{player.score}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className={styles.overlayActions}>
                {gameState.phase === 'round-end' && currentPlayer?.isHost && (
                  <button className={styles.nextBtn} onClick={handleGoToLobby}>
                    Continue →
                  </button>
                )}
                
                {gameState.phase === 'round-end' && !currentPlayer?.isHost && (
                  <p className={styles.waitHost}>Waiting for host to continue...</p>
                )}

                {gameState.phase === 'game-over' && (
                  <button 
                    className={styles.nextBtn} 
                    onClick={() => {
                      // Clear session and reload to start fresh
                      socket.emit('room:leave');
                      useGameStore.getState().clearSession();
                      window.location.reload();
                    }}
                  >
                    Play Again
                  </button>
                )}

                <button className={styles.leaveBtn} onClick={handleLeaveGame}>
                  Leave Game
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
