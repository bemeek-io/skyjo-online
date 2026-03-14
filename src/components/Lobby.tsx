import { useState } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store';
import { AVATARS } from '../../shared/constants';
import styles from './Lobby.module.css';

export function Lobby() {
  const { players, playerId, roomCode, setError, gameState } = useGameStore();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const currentPlayer = players.find(p => p.id === playerId);
  const isHost = currentPlayer?.isHost;
  
  // Check if we're between rounds (game in progress)
  const isBetweenRounds = (gameState?.roundNumber ?? 0) > 0;

  const usedAvatars = new Set(players.map(p => p.avatar));

  const handleStart = () => {
    if (players.length < 2) {
      setError('Need at least 2 players to start');
      return;
    }
    socket.emit('game:start');
  };

  const handleNextRound = () => {
    if (players.length < 2) {
      setError('Need at least 2 players to continue');
      return;
    }
    socket.emit('game:next-round');
  };

  const handleEndGame = () => {
    socket.emit('game:end-game');
  };

  const handleLeave = () => {
    socket.emit('room:leave');
    useGameStore.getState().clearSession();
  };

  const copyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      // Could show a toast here
    }
  };

  const handleKick = (targetPlayerId: string) => {
    socket.emit('room:kick', targetPlayerId);
  };

  const handleAvatarChange = (avatar: string) => {
    socket.emit('room:change-avatar', avatar);
    setShowAvatarPicker(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button className={styles.leaveBtn} onClick={handleLeave}>
          ← Leave
        </button>

        <div className={styles.header}>
          <p className={styles.label}>Room Code</p>
          <div className={styles.codeBox} onClick={copyCode}>
            <span className={styles.code}>{roomCode}</span>
            <span className={styles.copyHint}>Click to copy</span>
          </div>
        </div>

        <div className={styles.playersSection}>
          <h2>Players ({players.length}/20)</h2>
          <div className={styles.playersList}>
            {players.map((player, index) => (
              <div 
                key={player.id} 
                className={`${styles.playerCard} ${!player.connected ? styles.disconnected : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div 
                  className={`${styles.playerAvatar} ${player.id === playerId ? styles.ownAvatar : ''}`}
                  onClick={() => player.id === playerId && setShowAvatarPicker(true)}
                  title={player.id === playerId ? 'Click to change avatar' : undefined}
                >
                  {player.avatar || player.name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.playerInfo}>
                  <span className={styles.playerName}>
                    {player.name}
                    {player.id === playerId && <span className={styles.youBadge}>You</span>}
                  </span>
                  <div className={styles.playerMeta}>
                    {player.isHost && <span className={styles.hostBadge}>Host</span>}
                    {isBetweenRounds && player.score !== undefined && (
                      <span className={styles.scoreBadge}>{player.score} pts</span>
                    )}
                  </div>
                </div>
                <div className={styles.playerActions}>
                  <div className={`${styles.status} ${player.connected ? styles.online : styles.offline}`}>
                    {player.connected ? '●' : '○'}
                  </div>
                  {/* Host can kick other players (especially disconnected ones) */}
                  {isHost && player.id !== playerId && (
                    <button 
                      className={styles.kickBtn}
                      onClick={() => handleKick(player.id)}
                      title="Kick player"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.waitingSection}>
          {isBetweenRounds && (
            <div className={styles.roundInfo}>
              <span className={styles.roundBadge}>Round {gameState?.roundNumber} Complete</span>
            </div>
          )}
          
          {players.length < 2 ? (
            <div className={styles.waitingAlone}>
              <p className={styles.waitingText}>
                Waiting for more players to join...
              </p>
              {isHost && (
                <button className={styles.closeRoomBtn} onClick={handleLeave}>
                  Close Room
                </button>
              )}
            </div>
          ) : isHost ? (
            isBetweenRounds ? (
              <div className={styles.betweenRoundsActions}>
                <button className={styles.startBtn} onClick={handleNextRound}>
                  Start Round {(gameState?.roundNumber ?? 0) + 1} →
                </button>
                <button className={styles.endGameBtn} onClick={handleEndGame}>
                  End Game
                </button>
                <button className={styles.closeRoomBtn} onClick={handleLeave}>
                  Close Room
                </button>
              </div>
            ) : (
              <div className={styles.hostActions}>
                <button className={styles.startBtn} onClick={handleStart}>
                  Start Game
                </button>
                <button className={styles.closeRoomBtn} onClick={handleLeave}>
                  Close Room
                </button>
              </div>
            )
          ) : (
            <p className={styles.waitingText}>
              {isBetweenRounds 
                ? 'Waiting for host to start next round...'
                : 'Waiting for host to start the game...'
              }
            </p>
          )}
        </div>

        <div className={styles.shareSection}>
          <p>Share this code with friends to play together!</p>
          <div className={styles.shareUrl}>
            {window.location.origin}
          </div>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className={styles.avatarModal} onClick={() => setShowAvatarPicker(false)}>
          <div className={styles.avatarPicker} onClick={(e) => e.stopPropagation()}>
            <h3>Choose Your Avatar</h3>
            <div className={styles.avatarGrid}>
              {AVATARS.map((avatar) => {
                const isOwn = avatar === currentPlayer?.avatar;
                const isTaken = usedAvatars.has(avatar) && !isOwn;
                return (
                  <button
                    key={avatar}
                    className={`${styles.avatarOption} ${isOwn ? styles.avatarSelected : ''} ${isTaken ? styles.avatarTaken : ''}`}
                    onClick={() => !isTaken && handleAvatarChange(avatar)}
                    disabled={isTaken}
                    title={isTaken ? 'Already taken' : avatar}
                  >
                    {avatar}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

