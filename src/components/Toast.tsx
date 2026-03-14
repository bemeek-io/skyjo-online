import { useEffect } from 'react';
import { useGameStore } from '../store';
import styles from './Toast.module.css';

export function Toast() {
  const { error, setError } = useGameStore();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  if (!error) return null;

  return (
    <div className={styles.toast} onClick={() => setError(null)}>
      <span className={styles.icon}>⚠️</span>
      <span>{error}</span>
    </div>
  );
}

