/**
 * @fileoverview Theme Generation System
 * 
 * Handles theme selection and definition lookup for dungeon environments.
 * Themes control the visual and mechanical feel of dungeon segments,
 * including enemy types, trap styles, and ambient descriptions.
 * 
 * ## Available Themes
 * - `dungeon_start`: Ancient Sewers - vermin and slimes
 * - `crypt`: Forgotten Crypt - undead and skeletons
 * - `sewer`: Flooded Tunnels - vermin and oozes
 * - `cave`: Crystal Caverns - beasts and giants
 * - `forest`: Corrupted Grove - beasts and shapechangers
 * - `castle`: Ruined Fortress - humanoids and constructs
 * - `hell`: Infernal Depths - fiends and demons
 * 
 * @module engine/generateTheme
 */

import { SeededRNG } from '@lib/rng';
import { THEMES, type ThemeDef } from '../content/themes';
import type { RunState } from './types';

// ============================================================================
// 📦 Types
// ============================================================================

/**
 * Theme identifier type.
 * Can be a known theme key or any string for extensibility.
 */
export type ThemeId = keyof typeof THEMES | string;

// ============================================================================
// 🎨 Theme Constants
// ============================================================================

/** Default fallback theme when invalid ID is provided */
const DEFAULT_THEME_ID = 'dungeon_start';

// ============================================================================
// 🎲 generateTheme - Select a random theme
// ============================================================================

/**
 * Generate a theme ID for the current game state.
 * 
 * Uses seeded RNG for deterministic selection, ensuring the same seed
 * always produces the same theme sequence. This is essential for
 * replay functionality and debugging.
 * 
 * @param state - Current run state (currently unused, reserved for future filtering)
 * @param rng - Seeded random number generator
 * @returns A theme ID string from available themes
 * 
 * @example
 * const rng = new SeededRNG('my-seed');
 * const themeId = generateTheme(state, rng);
 * console.log(themeId); // e.g., 'crypt' or 'forest'
 * 
 * @example
 * // Same seed = same theme selection
 * const rng1 = new SeededRNG('test-seed');
 * const rng2 = new SeededRNG('test-seed');
 * generateTheme(state, rng1) === generateTheme(state, rng2); // true
 */
export function generateTheme(state: RunState, rng: SeededRNG): ThemeId {
  const themeKeys = Object.keys(THEMES);
  const index = rng.int(0, themeKeys.length - 1);
  return themeKeys[index];
}

// ============================================================================
// 📖 getThemeDef - Retrieve theme definition
// ============================================================================

/**
 * Get the theme definition for a given theme ID.
 * 
 * Returns the theme configuration object containing:
 * - Enemy tags (for filtering enemy pools)
 * - Trap tags (for hazard generation)
 * - Boss pool (for segment-end bosses)
 * - Ambiance text (for flavor descriptions)
 * 
 * Falls back to `dungeon_start` theme for:
 * - `null` or `undefined` values
 * - Non-string values
 * - Unknown theme IDs
 * 
 * @param themeId - The theme identifier to look up
 * @returns The theme definition object with all configuration
 * 
 * @example
 * const theme = getThemeDef('crypt');
 * console.log(theme.name);       // 'Forgotten Crypt'
 * console.log(theme.enemyTags);  // ['undead', 'skeleton', 'zombie']
 * 
 * @example
 * // Invalid input falls back to default
 * getThemeDef(null);       // → dungeon_start theme
 * getThemeDef('invalid');  // → dungeon_start theme
 * getThemeDef(undefined);  // → dungeon_start theme
 */
export function getThemeDef(themeId: ThemeId): ThemeDef {
  // Handle null, undefined, or invalid types
  if (themeId == null || typeof themeId !== 'string') {
    return THEMES[DEFAULT_THEME_ID];
  }
  
  // Return the theme or fallback to default
  return THEMES[themeId] || THEMES[DEFAULT_THEME_ID];
}

// ============================================================================
// 🔧 Helper Functions
// ============================================================================

/**
 * Get all available theme IDs.
 * 
 * Useful for UI theme selectors or random theme selection.
 * 
 * @returns Array of all valid theme ID strings
 * 
 * @example
 * const themes = getAllThemeIds();
 * console.log(themes); // ['dungeon_start', 'crypt', 'sewer', ...]
 */
export function getAllThemeIds(): ThemeId[] {
  return Object.keys(THEMES);
}

/**
 * Check if a theme ID is valid.
 * 
 * @param themeId - The theme ID to validate
 * @returns True if the theme exists, false otherwise
 * 
 * @example
 * isValidTheme('crypt');    // → true
 * isValidTheme('invalid');  // → false
 * isValidTheme(null);       // → false
 */
export function isValidTheme(themeId: unknown): themeId is ThemeId {
  if (typeof themeId !== 'string') return false;
  return themeId in THEMES;
}
