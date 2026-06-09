/**
 * @fileoverview Theme Definitions
 * 
 * Contains all theme configurations for dungeon environments.
 * Themes control the aesthetic and mechanical flavor of dungeon segments.
 * 
 * ## Theme Components
 * - **Enemy Tags**: Filter which monsters appear (e.g., undead, beast)
 * - **Trap Tags**: Filter which hazards appear (e.g., spikes, fire)
 * - **Boss Pool**: Theme-specific boss encounters
 * - **Ambiance**: Flavor text for room descriptions
 * 
 * ## Theme Selection
 * Themes are selected randomly at run start using seeded RNG.
 * The same seed always produces the same theme sequence.
 * 
 * @module content/themes
 */

// ============================================================================
// 📦 Types
// ============================================================================

/**
 * Theme definition for dungeon environments.
 * 
 * Each theme creates a distinct atmosphere by filtering:
 * - Which enemies can spawn (via tags)
 * - Which hazards can appear (via trap tags)
 * - Which bosses appear at segment ends
 * - What ambient descriptions are shown
 */
export interface ThemeDef {
  /** Unique identifier matching the THEMES key */
  id: string;
  /** Display name shown to player */
  name: string;
  /** Flavor description of the environment */
  description: string;
  /** Enemy tags allowed in this theme (filters ENEMIES array) */
  enemyTags: string[];
  /** Trap/hazard tags for this theme */
  trapTags: string[];
  /** Boss enemy IDs for segment-end encounters */
  bossPool: string[];
  /** Random ambient flavor text for room descriptions */
  ambiance: string[];
}

// ============================================================================
// 🏰 Theme Definitions
// ============================================================================

/**
 * Complete theme registry.
 * 
 * ## Available Themes
 * | ID           | Name              | Primary Enemies          |
 * |--------------|-------------------|--------------------------|
 * | dungeon_start| Ancient Sewers    | Vermin, slimes, beasts   |
 * | crypt        | Forgotten Crypt   | Undead, skeletons        |
 * | sewer        | Flooded Tunnels   | Vermin, oozes            |
 * | cave         | Crystal Caverns   | Beasts, giants           |
 * | forest       | Corrupted Grove   | Beasts, shapechangers    |
 * | castle       | Ruined Fortress   | Humanoids, constructs    |
 * | hell         | Infernal Depths   | Fiends, demons           |
 * 
 * @example
 * const theme = THEMES['crypt'];
 * console.log(theme.name);       // 'Forgotten Crypt'
 * console.log(theme.enemyTags);  // ['undead', 'skeleton', 'zombie']
 */
export const THEMES: Record<string, ThemeDef> = {
  // ========================================
  // 🚿 DUNGEON START - Ancient Sewers
  // Beginner-friendly with vermin and slimes
  // ========================================
  dungeon_start: {
    id: 'dungeon_start',
    name: 'Ancient Sewers',
    description: 'A damp, moss-covered sewer system beneath the city.',
    enemyTags: ['vermin', 'slime', 'humanoid', 'beast'],
    trapTags: ['tripwire', 'spikes'],
    bossPool: ['sewer_king'],
    ambiance: [
      'The smell of rot is overpowering.',
      'Scurrying sounds echo in the darkness.',
      'Slime drips from the ceiling.',
    ],
  },

  // ========================================
  // ⚰️ CRYPT - Forgotten Crypt
  // Undead-focused with curse hazards
  // ========================================
  crypt: {
    id: 'crypt',
    name: 'Forgotten Crypt',
    description: 'Rows of silent tombs line the walls.',
    enemyTags: ['undead', 'skeleton', 'zombie'],
    trapTags: ['darts', 'curse'],
    bossPool: ['lich_acolyte'],
    ambiance: [
      'A cold draft chills your bones.',
      'Dust motes dance in the torchlight.',
      'You feel watched by the statues.',
    ],
  },

  // ========================================
  // 🌊 SEWER - Flooded Tunnels
  // Ooze and vermin in wet environments
  // ========================================
  sewer: {
    id: 'sewer',
    name: 'Flooded Tunnels',
    description: 'Murky water flows through ancient stone passages.',
    enemyTags: ['vermin', 'slime', 'ooze', 'beast'],
    trapTags: ['poison', 'spikes'],
    bossPool: ['sewer_beast'],
    ambiance: [
      'Water drips endlessly.',
      'Something splashes in the distance.',
      'The air is thick with moisture.',
    ],
  },

  // ========================================
  // 💎 CAVE - Crystal Caverns
  // Beasts and giants in natural caves
  // ========================================
  cave: {
    id: 'cave',
    name: 'Crystal Caverns',
    description: 'Natural caves glittering with strange minerals.',
    enemyTags: ['beast', 'monstrosity', 'giant'],
    trapTags: ['cave_in', 'spikes'],
    bossPool: ['cave_troll'],
    ambiance: [
      'Crystals hum with faint energy.',
      'Stalactites drip mineral water.',
      'Echoes carry for miles.',
    ],
  },

  // ========================================
  // 🌲 FOREST - Corrupted Grove
  // Twisted nature with shapechangers
  // ========================================
  forest: {
    id: 'forest',
    name: 'Corrupted Grove',
    description: 'A forest twisted by dark magic.',
    enemyTags: ['beast', 'humanoid', 'monstrosity', 'shapechanger'],
    trapTags: ['vines', 'thorns'],
    bossPool: ['forest_lord'],
    ambiance: [
      'The trees seem to watch you.',
      'Unnatural sounds echo through the branches.',
      'A thick mist clings to the ground.',
    ],
  },

  // ========================================
  // 🏰 CASTLE - Ruined Fortress
  // Humanoids and constructs in ruins
  // ========================================
  castle: {
    id: 'castle',
    name: 'Ruined Fortress',
    description: 'A once-mighty castle fallen to ruin.',
    enemyTags: ['humanoid', 'undead', 'knight', 'construct'],
    trapTags: ['arrows', 'pit'],
    bossPool: ['fallen_king'],
    ambiance: [
      'Armor stands guard the halls.',
      'Faded tapestries line the walls.',
      'The echo of battles long past lingers.',
    ],
  },

  // ========================================
  // 🔥 HELL - Infernal Depths
  // Fiends and demons in hellfire
  // ========================================
  hell: {
    id: 'hell',
    name: 'Infernal Depths',
    description: 'A plane of fire and torment.',
    enemyTags: ['fiend', 'demon', 'magic'],
    trapTags: ['fire', 'lava'],
    bossPool: ['demon_prince'],
    ambiance: [
      'Flames dance without fuel.',
      'Screams echo from unseen sources.',
      'The heat is oppressive.',
    ],
  },
};

// ============================================================================
// 🔧 Helper Functions
// ============================================================================

/**
 * Get all available theme IDs.
 * 
 * @returns Array of theme ID strings
 * 
 * @example
 * const ids = getThemeIds();
 * // ['dungeon_start', 'crypt', 'sewer', 'cave', 'forest', 'castle', 'hell']
 */
export function getThemeIds(): string[] {
  return Object.keys(THEMES);
}

/**
 * Get the total number of available themes.
 * 
 * @returns Number of themes
 */
export function getThemeCount(): number {
  return Object.keys(THEMES).length;
}

/**
 * Get a random ambient text for a theme.
 * 
 * @param themeId - Theme ID to get ambiance from
 * @param index - Optional specific index (random if omitted)
 * @returns Ambient flavor text or empty string if theme not found
 * 
 * @example
 * const text = getAmbiance('crypt', 0);
 * // 'A cold draft chills your bones.'
 */
export function getAmbiance(themeId: string, index?: number): string {
  const theme = THEMES[themeId];
  if (!theme || theme.ambiance.length === 0) return '';
  
  const i = index !== undefined 
    ? Math.max(0, Math.min(index, theme.ambiance.length - 1))
    : Math.floor(Math.random() * theme.ambiance.length);
    
  return theme.ambiance[i];
}

/**
 * Check if a theme supports a specific enemy tag.
 * 
 * @param themeId - Theme ID to check
 * @param tag - Enemy tag to look for
 * @returns True if the theme includes the tag
 * 
 * @example
 * themeSupportsTag('crypt', 'undead');  // true
 * themeSupportsTag('crypt', 'beast');   // false
 */
export function themeSupportsTag(themeId: string, tag: string): boolean {
  const theme = THEMES[themeId];
  return theme ? theme.enemyTags.includes(tag) : false;
}
