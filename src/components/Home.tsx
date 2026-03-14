import { useState } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store';
import styles from './Home.module.css';

export function Home() {
  const { playerName, setPlayerName, setError, setView } = useGameStore();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setIsCreating(true);
    socket.emit('room:create', playerName.trim(), (response) => {
      setIsCreating(false);
      if (!response.success) {
        setError(response.error || 'Failed to create room');
      }
    });
  };

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setIsJoining(true);
    socket.emit('room:join', joinCode.trim().toUpperCase(), playerName.trim(), (response) => {
      setIsJoining(false);
      if (!response.success) {
        setError(response.error || 'Failed to join room');
      }
    });
  };

  const handleCreateDisplay = () => {
    socket.emit('room:create-display', (response) => {
      if (response.success) {
        useGameStore.getState().setPlayerInfo('display', response.roomCode!);
        setView('display');
      } else {
        setError(response.error || 'Failed to create display room');
      }
    });
  };

  const handleJoinDisplay = () => {
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    socket.emit('room:join-display', joinCode.trim().toUpperCase(), (response) => {
      if (response.success) {
        useGameStore.getState().setPlayerInfo('display', joinCode.trim().toUpperCase());
        setView('display');
      } else {
        setError(response.error || 'Failed to join as display');
      }
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.sky}>Sky</span>
            <span className={styles.jo}>Jo</span>
          </h1>
          <p className={styles.subtitle}>Online</p>
        </div>

        <div className={styles.cards}>
          <div className={`${styles.floatingCard} ${styles.card1}`}>-2</div>
          <div className={`${styles.floatingCard} ${styles.card2}`}>5</div>
          <div className={`${styles.floatingCard} ${styles.card3}`}>12</div>
        </div>

        <div className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name..."
              maxLength={20}
            />
          </div>

          <div className={styles.actions}>
            <button 
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Game'}
            </button>

            <div className={styles.divider}>
              <span>or join</span>
            </div>

            <div className={styles.joinGroup}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={4}
                className={styles.codeInput}
              />
              <button 
                className={styles.joinBtn}
                onClick={handleJoin}
                disabled={isJoining}
              >
                {isJoining ? '...' : 'Join'}
              </button>
            </div>
          </div>

          <div className={styles.displaySection}>
            <div className={styles.divider}>
              <span>TV / Display Mode</span>
            </div>
            <div className={styles.displayActions}>
              <button className={styles.displayBtn} onClick={handleCreateDisplay}>
                Host Display
              </button>
              <button 
                className={styles.displayBtn} 
                onClick={handleJoinDisplay}
                disabled={!joinCode.trim()}
              >
                View Room
              </button>
            </div>
            <p className={styles.displayHint}>
              Display mode shows all players' boards on a TV without being a player
            </p>
          </div>
        </div>

        <div className={styles.rules}>
          <button 
            className={styles.rulesToggle}
            onClick={() => setShowRules(!showRules)}
          >
            {showRules ? '▼' : '▶'} How to Play
          </button>
          
          {showRules && (
            <div className={styles.rulesContent}>
              <div className={styles.ruleSection}>
                <h4>Goal</h4>
                <p>Get the <strong>lowest score</strong>. Cards range from -2 to 12.</p>
              </div>
              
              <div className={styles.ruleSection}>
                <h4>Setup</h4>
                <p>Each player has 12 face-down cards in a 3×4 grid. Flip any 2 cards to start. <strong>Highest total goes first.</strong></p>
              </div>
              
              <div className={styles.ruleSection}>
                <h4>Your Turn</h4>
                <p><strong>Option 1:</strong> Draw from discard pile → must swap it with one of your cards.</p>
                <p><strong>Option 2:</strong> Draw from deck → look at it, then either swap it with any card OR discard it and flip one of your hidden cards.</p>
              </div>
              
              <div className={styles.ruleSection}>
                <h4>Column Match</h4>
                <p>3 matching cards in a column? They're <strong>discarded</strong> (great for your score!)</p>
              </div>
              
              <div className={styles.ruleSection}>
                <h4>Ending</h4>
                <p>Reveal all your cards to trigger the <strong>final round</strong>. Others get one more turn.</p>
                <p><strong>Warning:</strong> If you end the round but don't have the lowest score, your <em>positive</em> points are doubled!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
