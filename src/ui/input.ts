/**
 * Input handling for game commands
 */

export type GameCommand =
  | { type: 'MOVE'; direction: 'forward' | 'back' }
  | { type: 'REST'; restType: 'short' | 'long' }
  | { type: 'ATTACK' }
  | { type: 'LOOT' }
  | { type: 'INSPECT' }
  | { type: 'HELP' }
  | { type: 'QUIT' };

export function parseInput(input: string): GameCommand | null {
  const normalized = input.toLowerCase().trim();
  
  if (normalized === 'f' || normalized === 'forward' || normalized === 'move forward') {
    return { type: 'MOVE', direction: 'forward' };
  }
  
  if (normalized === 'b' || normalized === 'back' || normalized === 'move back') {
    return { type: 'MOVE', direction: 'back' };
  }
  
  if (normalized === 'r' || normalized === 'rest' || normalized === 'short rest') {
    return { type: 'REST', restType: 'short' };
  }
  
  if (normalized === 'lr' || normalized === 'long rest') {
    return { type: 'REST', restType: 'long' };
  }
  
  if (normalized === 'a' || normalized === 'attack') {
    return { type: 'ATTACK' };
  }
  
  if (normalized === 'l' || normalized === 'loot') {
    return { type: 'LOOT' };
  }
  
  if (normalized === 'i' || normalized === 'inspect') {
    return { type: 'INSPECT' };
  }
  
  if (normalized === 'h' || normalized === 'help') {
    return { type: 'HELP' };
  }
  
  if (normalized === 'q' || normalized === 'quit') {
    return { type: 'QUIT' };
  }
  
  return null;
}
