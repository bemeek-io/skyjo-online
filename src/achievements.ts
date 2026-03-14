import type { Player } from '../shared/types';

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  playerId: string;
  priority: number; // Higher = more important, used for tiebreaking
}

// All possible achievements - at least 20 so everyone can have one
const ACHIEVEMENT_CHECKS: Array<{
  id: string;
  name: string;
  emoji: string;
  description: string;
  priority: number;
  check: (player: PlayerStats, allStats: PlayerStats[], triggeredById: string | null) => boolean;
}> = [
  {
    id: 'round-winner',
    name: 'Round Champion',
    emoji: '🏆',
    description: 'You had the lowest score this round!',
    priority: 100,
    check: (p, all) => all.sort((a, b) => a.score - b.score)[0]?.player.id === p.player.id
  },
  {
    id: 'second-place',
    name: 'Runner Up',
    emoji: '🥈',
    description: 'Second lowest score - so close!',
    priority: 90,
    check: (p, all) => {
      const sorted = [...all].sort((a, b) => a.score - b.score);
      return sorted.length > 1 && sorted[1]?.player.id === p.player.id;
    }
  },
  {
    id: 'third-place',
    name: 'Bronze Medal',
    emoji: '🥉',
    description: 'Third place finish - nice work!',
    priority: 80,
    check: (p, all) => {
      const sorted = [...all].sort((a, b) => a.score - b.score);
      return sorted.length > 2 && sorted[2]?.player.id === p.player.id;
    }
  },
  {
    id: 'precision',
    name: 'Precision',
    emoji: '🎯',
    description: 'You scored exactly zero points!',
    priority: 95,
    check: (p) => p.score === 0
  },
  {
    id: 'negative-master',
    name: 'Negative Master',
    emoji: '🍀',
    description: 'You collected 3+ negative cards!',
    priority: 85,
    check: (p) => p.negativeCards >= 3
  },
  {
    id: 'double-negative',
    name: 'Double Negative',
    emoji: '➖',
    description: 'You had 2 negative cards working for you!',
    priority: 60,
    check: (p) => p.negativeCards === 2
  },
  {
    id: 'clean-sweep',
    name: 'Clean Sweep',
    emoji: '✨',
    description: 'You cleared 2 or more columns!',
    priority: 88,
    check: (p) => p.clearedCols >= 2
  },
  {
    id: 'column-master',
    name: 'Column Master',
    emoji: '📊',
    description: 'You successfully cleared a column!',
    priority: 65,
    check: (p) => p.clearedCols >= 1
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    emoji: '🔥',
    description: 'You triggered the final round!',
    priority: 75,
    check: (p, _, triggeredById) => p.player.id === triggeredById
  },
  {
    id: 'risk-taker',
    name: 'Risk Taker',
    emoji: '💀',
    description: 'You ended the round but got doubled!',
    priority: 70,
    check: (p, all, triggeredById) => {
      if (p.player.id !== triggeredById || p.score <= 0) return false;
      return all.some(other => other.player.id !== p.player.id && other.score <= p.score);
    }
  },
  {
    id: 'all-lows',
    name: 'Low Roller',
    emoji: '💎',
    description: 'All your cards were 5 or under!',
    priority: 82,
    check: (p) => p.player.cards.every(c => (c as any).cleared || c.value <= 5)
  },
  {
    id: 'mostly-lows',
    name: 'Playing It Safe',
    emoji: '🛡️',
    description: 'Most of your cards were low value!',
    priority: 50,
    check: (p) => p.lowCards >= 8
  },
  {
    id: 'survivor',
    name: 'Survivor',
    emoji: '🏃',
    description: 'You made it through with an okay score!',
    priority: 30,
    check: (p) => p.score > 0 && p.score <= 15
  },
  {
    id: 'middle-ground',
    name: 'Middle of the Pack',
    emoji: '⚖️',
    description: 'You finished right in the middle!',
    priority: 35,
    check: (p, all) => {
      const sorted = [...all].sort((a, b) => a.score - b.score);
      const midIndex = Math.floor(sorted.length / 2);
      return sorted.length >= 4 && sorted[midIndex]?.player.id === p.player.id;
    }
  },
  {
    id: 'zero-hero',
    name: 'Zero Hero',
    emoji: '0️⃣',
    description: 'You had multiple zero cards!',
    priority: 55,
    check: (p) => p.zeroCards >= 2
  },
  {
    id: 'variety-pack',
    name: 'Variety Pack',
    emoji: '🎨',
    description: 'You had a wide range of card values!',
    priority: 40,
    check: (p) => p.uniqueValues >= 8
  },
  {
    id: 'high-roller',
    name: 'High Roller',
    emoji: '🎰',
    description: 'You were brave with those high cards!',
    priority: 45,
    check: (p) => p.highCards >= 2 && p.highCards < 3
  },
  {
    id: 'unlucky',
    name: 'Unlucky',
    emoji: '😱',
    description: 'You got stuck with 3+ high cards!',
    priority: 50,
    check: (p) => p.highCards >= 3
  },
  {
    id: 'card-shark',
    name: 'Card Shark',
    emoji: '🦈',
    description: 'You played strategically all round!',
    priority: 25,
    check: (p) => p.score <= 20 && p.clearedCols === 0
  },
  {
    id: 'close-call',
    name: 'Close Call',
    emoji: '😅',
    description: 'That was a close one!',
    priority: 20,
    check: (p) => p.score > 15 && p.score <= 25
  },
  {
    id: 'tough-round',
    name: 'Tough Round',
    emoji: '💪',
    description: 'You faced some challenging cards!',
    priority: 15,
    check: (p) => p.score > 25 && p.score <= 40
  },
  {
    id: 'ouch',
    name: 'Ouch',
    emoji: '😬',
    description: 'That round hurt! Better luck next time.',
    priority: 10,
    check: (p, all) => {
      const sorted = [...all].sort((a, b) => a.score - b.score);
      return sorted[sorted.length - 1]?.player.id === p.player.id && p.score > 30;
    }
  },
  {
    id: 'participant',
    name: 'Team Player',
    emoji: '🤝',
    description: 'Thanks for playing this round!',
    priority: 1,
    check: () => true // Fallback - everyone qualifies
  }
];

interface PlayerStats {
  player: Player;
  score: number;
  clearedCols: number;
  negativeCards: number;
  zeroCards: number;
  lowCards: number;
  highCards: number;
  uniqueValues: number;
}

export function calculateAchievements(
  players: Player[],
  triggeredById: string | null
): Achievement[] {
  const activePlayers = players.filter(p => !p.isDisplay);
  
  if (activePlayers.length === 0) return [];
  
  // Calculate stats for each player
  const playerStats: PlayerStats[] = activePlayers.map(p => {
    const activeCards = p.cards.filter(c => !(c as any).cleared);
    const values = activeCards.map(c => c.value);
    
    return {
      player: p,
      score: activeCards.reduce((sum, c) => sum + c.value, 0),
      clearedCols: countClearedColumns(p),
      negativeCards: activeCards.filter(c => c.value < 0).length,
      zeroCards: activeCards.filter(c => c.value === 0).length,
      lowCards: activeCards.filter(c => c.value <= 5).length,
      highCards: activeCards.filter(c => c.value >= 10).length,
      uniqueValues: new Set(values).size
    };
  });
  
  const achievements: Achievement[] = [];
  const assignedPlayers = new Set<string>();
  
  // Sort achievements by priority (highest first)
  const sortedChecks = [...ACHIEVEMENT_CHECKS].sort((a, b) => b.priority - a.priority);
  
  // Assign one achievement per player, highest priority first
  for (const check of sortedChecks) {
    for (const stats of playerStats) {
      // Skip if player already has an achievement
      if (assignedPlayers.has(stats.player.id)) continue;
      
      // Check if this player qualifies
      if (check.check(stats, playerStats, triggeredById)) {
        achievements.push({
          id: check.id,
          name: check.name,
          emoji: check.emoji,
          description: check.description,
          playerId: stats.player.id,
          priority: check.priority
        });
        assignedPlayers.add(stats.player.id);
        break; // Move to next achievement type
      }
    }
    
    // Stop if everyone has an achievement
    if (assignedPlayers.size >= activePlayers.length) break;
  }
  
  return achievements;
}

function countClearedColumns(player: Player): number {
  let count = 0;
  for (let col = 0; col < 4; col++) {
    const indices = [col, col + 4, col + 8];
    if (indices.every(i => (player.cards[i] as any).cleared)) {
      count++;
    }
  }
  return count;
}

// Get a single player's achievement
export function getPlayerAchievement(
  achievements: Achievement[],
  playerId: string
): Achievement | null {
  return achievements.find(a => a.playerId === playerId) || null;
}
