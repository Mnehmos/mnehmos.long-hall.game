/**
 * ASCII Art Assets for The Long Hall
 * Each art piece is a multi-line string using template literals.
 */

// ============== HEROES ==============
export const HERO_ART: Record<string, string> = {
  fighter: `
      ┌───┐
     ╔╧═══╧╗
     ║ ● ● ║
     ║  ▼  ║
     ╚══╤══╝
    ╔═══╧═══╗
   ╔╝ ╔═══╗ ╚╗
   ║  ║███║  ║
   ╚╗ ╚═══╝ ╔╝
    ╚═══════╝
      ║   ║
      ╨   ╨
`,
  wizard: `
       /\\
      /  \\
     / ★★ \\
    /══════\\
     ║ ◉ ◉ ║
     ║  ◡  ║
     ╚══╤══╝
    ╔═══╧═══╗
    ║ ░░░░░ ║
    ║ ░░░░░ ║
    ╚═══════╝
      │   │
`,
  rogue: `
      ╭───╮
     ╭╯▀▀▀╰╮
    ╭╯░░░░░╰╮
   ╔╧═══════╧╗
   ║  •   •  ║
   ║    ∧    ║
   ╚════╤════╝
    ╔═══╧═══╗
    ║ ▒▒▒▒▒ ║
    ╚═══════╝
      ╱   ╲
`,
  cleric: `
       ╬
     ╔═╩═╗
     ║◉ ◉║
     ║ ─ ║
     ╚═╤═╝
    ╔══╧══╗
    ║█╫█╫█║
    ║█╫█╫█║
    ║█████║
    ╚═════╝
      │ │
`,
  ranger: `
      _/
     ╭───╮
    ╱ ▓▓▓ ╲
   ╔═══════╗
   ║ ◉   ◉ ║
   ║   ▽   ║
   ╚═══╤═══╝
   ╔═══╧═══╗
   ║ ░▓░▓░ ║
   ╚═══════╝
    ╱     ╲
`,
};

// ============== ENEMIES ==============
export const ENEMY_ART: Record<string, string> = {
  skeleton: `
    .-.
   (o.o)
    |=|
   __|__
  /|   |\\
   |   |
  _|   |_
`,
  zombie: `
   .---.
  ( x x )
   \\   /
    |~|
   /| |\\
  | | | |
  '-' '-'
`,
  goblin: `
    /\\
   (oo)
   <  >
   |__|
  /|  |\\
  ||  ||
`,
  rat: `
   (\\,/)
  (='.'=)
 (")(")_/
`,
  boss: `
      /\\
     /  \\
    / ⚡ \\
   |  OO  |
   | \\_-_/|
   |______|
  /|      |\\
 | |      | |
 | |      | |
`,
  default: `
   ???
  (   )
   \\_/
`,
};

// ============== EQUIPMENT ICONS ==============
export const EQUIPMENT_ICONS: Record<string, string> = {
  head: `  ╭───╮
 ╭╯ ◠ ╰╮
 ╰─────╯`,
  neck: ` ╭─╮
 │◆│
 ╰┬╯`,
  chest: `╔═════╗
║ ▓▓▓ ║
║ ▓▓▓ ║
╚═════╝`,
  main_hand: `   │
  ╔╧╗
  ║▓║
  ║▓║
  ╚═╝`,
  off_hand: `╭─────╮
│ ╲╱  │
│ ╱╲  │
╰─────╯`,
  legs: ` ╔═══╗
 ║   ║
 ╠═╤═╣
 ║ │ ║`,
  feet: `┌──┐┌──┐
│▓▓││▓▓│
└──┘└──┘`,
  ring1: `╭───╮
│ ○ │
╰───╯`,
  ring2: `╭───╮
│ ◎ │
╰───╯`,
};

// ============== UI ELEMENTS ==============
export const UI_ELEMENTS = {
  hp_full: '█',
  hp_empty: '░',
  border_h: '═',
  border_v: '║',
  corner_tl: '╔',
  corner_tr: '╗',
  corner_bl: '╚',
  corner_br: '╝',
};

/**
 * Generate an HP bar string
 * @param current Current HP
 * @param max Max HP
 * @param width Width of the bar in characters
 */
export function renderHpBar(current: number, max: number, width: number = 10): string {
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  return '[' + UI_ELEMENTS.hp_full.repeat(filled) + UI_ELEMENTS.hp_empty.repeat(empty) + ']';
}

/**
 * Generate a stat bar string with customizable characters
 * @param current Current value
 * @param max Max value
 * @param width Width of the bar in characters
 * @param filledChar Character for filled portion
 * @param emptyChar Character for empty portion
 */
export function renderStatBar(
  current: number,
  max: number,
  width: number = 10,
  filledChar: string = '█',
  emptyChar: string = '░'
): string {
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Get ASCII art for an enemy by ID prefix
 */
export function getEnemyArt(enemyId: string): string {
  // Extract base type from ID like "skeleton-0" -> "skeleton"
  const baseType = enemyId.split('-')[0];
  return ENEMY_ART[baseType] || ENEMY_ART.default;
}

/**
 * Get ASCII art for a hero by role
 */
export function getHeroArt(role: string): string {
  return HERO_ART[role] || HERO_ART.fighter;
}
