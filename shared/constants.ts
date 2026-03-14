export const CARD_DISTRIBUTION: Record<number, number> = {
  [-2]: 5,
  [-1]: 10,
  [0]: 15,
  [1]: 10,
  [2]: 10,
  [3]: 10,
  [4]: 10,
  [5]: 10,
  [6]: 10,
  [7]: 10,
  [8]: 10,
  [9]: 10,
  [10]: 10,
  [11]: 10,
  [12]: 10
};

export const GRID_ROWS = 3;
export const GRID_COLS = 4;
export const CARDS_PER_PLAYER = GRID_ROWS * GRID_COLS; // 12

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;

export const WINNING_SCORE = 100; // Game ends when someone reaches this

export const ROOM_CODE_LENGTH = 4;

// 20 distinct, fun avatars for players
export const AVATARS = [
  '🦊', // Fox
  '🐼', // Panda
  '🦁', // Lion
  '🐸', // Frog
  '🦉', // Owl
  '🐙', // Octopus
  '🦋', // Butterfly
  '🐢', // Turtle
  '🦄', // Unicorn
  '🐲', // Dragon
  '🦈', // Shark
  '🦩', // Flamingo
  '🐺', // Wolf
  '🦜', // Parrot
  '🐨', // Koala
  '🦔', // Hedgehog
  '🦭', // Seal
  '🐳', // Whale
  '🦚', // Peacock
  '🐝', // Bee
] as const;

export type Avatar = typeof AVATARS[number];

