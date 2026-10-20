export type GameDifficulty = 'easy' | 'normal' | 'hard';

export type TimeOfDay = 'day' | 'sunset' | 'night';

export interface GullSkin {
  id: string;
  name: string;
  description: string;
  unlockedAt: number; // score needed to unlock, or fishes needed
  unlockedType: 'score' | 'fish' | 'free';
  color: string;
  beakColor: string;
  specialEffect?: 'feather' | 'sparkle' | 'shadow' | 'rainbow';
  accessory?: 'none' | 'sunglasses' | 'hat' | 'crown';
}

export interface Obstacle {
  x: number;
  width: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
  rockTypeTop: number;    // random seed for drawing craggy rocks
  rockTypeBottom: number; // random seed for drawing craggy rocks
}

export interface Collectible {
  x: number;
  y: number;
  type: 'fish' | 'star' | 'shield';
  collected: boolean;
  size: number;
  pulsePhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  rotation: number;
  vRotation: number;
  type: 'feather' | 'sparkle' | 'splash' | 'bubble';
  life: number;
  maxLife: number;
}

export interface ScoreRecord {
  score: number;
  difficulty: GameDifficulty;
  date: string;
  fishCollected: number;
  playerName: string;
}

export interface GameStats {
  totalGames: number;
  totalFlaps: number;
  totalFishes: number;
  highestScore: number;
}
