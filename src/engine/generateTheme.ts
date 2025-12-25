import { SeededRNG } from '../core/rng';
import { THEMES, type ThemeDef } from '../content/themes';
import type { RunState } from './types';

export function generateTheme(_state: RunState, rng: SeededRNG): string {
    // For v1, maybe a simple progression or random pick not matching the current one
    // Deterministic selection based on seed and segment index.
    
    // We can use the current theme from state if we are inside a segment,
    // or pick a new one if we are at the start of a new segment.
    
    // logic:
    // Determine segment index from depth (depth 0-9 = seg 0, 10-19 = seg 1)

    
    // If we want a fixed sequence per seed:
    // Create a temporary RNG for theme selection using (seed + segmentIndex)
    // Avoid using the "game state rng" inside here if we want pure functional generation
    // but typically we pass the main RNG.
    
    const themeKeys = Object.keys(THEMES);
    
    // Simple rotation for now to ensure variety?
    // Or random pick.
    const index = rng.int(0, themeKeys.length - 1);
    return themeKeys[index];
}

export function getThemeDef(themeId: string): ThemeDef {
    return THEMES[themeId] || THEMES['dungeon_start'];
}
