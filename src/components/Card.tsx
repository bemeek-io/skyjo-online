import type { CardValue } from '../../shared/types';
import styles from './Card.module.css';

interface CardProps {
  value?: CardValue;
  revealed: boolean;
  cleared?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  isDrawn?: boolean;
  size?: 'tiny' | 'small' | 'normal' | 'large';
  highlight?: boolean;
}

function getCardColor(value: CardValue): string {
  if (value <= -1) return 'negative';
  if (value === 0) return 'zero';
  if (value <= 4) return 'low';
  if (value <= 8) return 'mid';
  if (value <= 11) return 'high';
  return 'max';
}

export function Card({ 
  value, 
  revealed, 
  cleared,
  onClick, 
  disabled, 
  isDrawn,
  size = 'normal',
  highlight
}: CardProps) {
  if (cleared) {
    return <div className={`${styles.card} ${styles.cleared} ${styles[size]}`} />;
  }

  const colorClass = revealed && value !== undefined ? styles[getCardColor(value)] : '';
  
  return (
    <div
      className={`
        ${styles.card} 
        ${styles[size]}
        ${revealed ? styles.revealed : styles.hidden}
        ${colorClass}
        ${disabled ? styles.disabled : ''}
        ${isDrawn ? styles.drawn : ''}
        ${highlight ? styles.highlight : ''}
        ${onClick && !disabled ? styles.clickable : ''}
      `}
      onClick={!disabled && onClick ? onClick : undefined}
    >
      {revealed && value !== undefined ? (
        <span className={styles.value}>{value}</span>
      ) : (
        <div className={styles.back}>
          <span className={styles.logo}>S</span>
        </div>
      )}
    </div>
  );
}

