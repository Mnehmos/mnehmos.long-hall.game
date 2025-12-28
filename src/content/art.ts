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
  // ========== TIER 1 (Power 1-2) ==========
  rat_swarm: `
   (\\,/)  (\\,/)
  (='.'=)(='.'=)
 (")_(")(")(")_/
`,
  giant_rat: `
    (\\,/)
   (='.'=)
  (")_(")_/
`,
  kobold: `
    /\\
   (oo)
   <  >
   |__|
  /|  |\\
`,
  goblin: `
    /\\
   (oo)
   <  >
   |__|
  /|  |\\
  ||  ||
`,
  slime: `
   .---.
  ( ~ ~ )
  (  O  )
   '---'
`,
  giant_spider: `
   /\\  /\\
  //\\\\//\\\\
 ((  @@  ))
  \\\\    //
   \\\\||//
`,
  stirge: `
  \\  /
   \\/
  (@@)
   \\/\\
`,
  bandit: `
   ___
  (   )
  |o o|
  | > |
  |___|
  /| |\\
`,

  // ========== TIER 2 (Power 3-4) ==========
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
  dire_wolf: `
    /\\_/\\
   / o o \\
  (   "   )
   \\  ^  /
    \\_|_/
    /| |\\
`,
  hobgoblin: `
   _____
  / o o \\
  |  >  |
  |\\___/|
  /|   |\\
  ||   ||
`,
  gnoll: `
    /|\\
   / o \\
  |  V  |
  | === |
  /|   |\\
  || _ ||
`,
  cultist: `
    /\\
   /  \\
  | oo |
  | \\/ |
  |____|
  /|  |\\
`,
  bugbear: `
  (\\_/)
 ((o o))
  ( " )
  |___|
 /|   |\\
 || | ||
`,
  harpy: `
   ___
  (o o)
  /\\ /\\
 /  V  \\
 | === |
  \\   /
`,

  // ========== TIER 3 (Power 5-6) ==========
  orc: `
   ___
  /o_o\\
  | > |
  |===|
 /|   |\\
 ||   ||
  U   U
`,
  ghoul: `
   .-.
  (x_x)
   |~|
  /| |\\
  | | |
  _| |_
   \\ /
`,
  wight: `
   .--.
  ( oo )
   |==|
   |  |
  /|  |\\
  || _ ||
`,
  owlbear: `
   /\\_/\\
  ( o o )
   ( O )
  /|   |\\
 | |===| |
  |  |  |
`,
  minotaur: `
  |\\   /|
  ( o o )
   | M |
  /|===|\\
 | |   | |
 | |   | |
`,
  werewolf: `
    /|
   / |\\
  |o o|
  | V |
  |===|
 /|   |\\
  || ||
`,
  troll: `
    ___
   /   \\
  | o o |
  |  >  |
  |=====|
 /|     |\\
 ||     ||
`,
  wraith: `
   .---.
  /     \\
 | () () |
  \\  ~  /
   |===|
    | |
    ~~~
`,

  // ========== TIER 4 (Power 7-8) ==========
  ogre: `
   _____
  / o o \\
  |  O  |
  |=====|
 /|     |\\
 || | | ||
 |_|   |_|
`,
  ettin: `
  ___ ___
 /o o o o\\
 | > | > |
 |==   ==|
   |   |
  /|   |\\
`,
  vampire_spawn: `
   /\\  /\\
  ( o o )
   | v |
   |===|
  /|   |\\
  || _ ||
`,
  manticore: `
  /\\   /\\
 ( o   o )
  \\ === /
   |   |
  /|===|\\
  _||_||_
     ~~~
`,
  hill_giant: `
    ___
   /   \\
  | O O |
  |  >  |
  |_____|
 /|     |\\
 ||     ||
 ||_____||
`,
  flesh_golem: `
   .---.
  /o   o\\
  |  =  |
  |=====|
 [|     |]
  ||   ||
  |_| |_|
`,
  chimera: `
  /| |\\
 ( O O O )
  \\=====/ 
   |   |
  /|===|\\
  _|| ||_
`,
  oni: `
   _/\\_
  / o o \\
  | === |
  |  ^  |
  |_____|
 /|     |\\
`,

  // ========== TIER 5 (Power 9-10) ==========
  frost_giant: `
    ___
   /~~~\\
  | O O |
  |  >  |
  |=====|
 /|~~~~~|\\
 ||     ||
 ||_____||
`,
  fire_giant: `
   /\\/\\
  /~~~~\\
 | O  O |
 |  >>  |
 |======|
/|  ~~  |\\
||      ||
`,
  young_dragon: `
    /\\
   /  \\
  / OO \\
  \\=====/
   |   |
  /|===|\\
  ~||_||~
`,
  beholder_zombie: `
   ___
  /o o\\
 ( === )
  \\^^^/
   ~~~
`,
  mind_flayer: `
   .--.
  ( oo )
  /WWWW\\
  |    |
 /|    |\\
  ||  ||
`,
  death_knight: `
   ___
  /x x\\
  |===|
 /|   |\\
 ||###||
 ||___||
 _|   |_
`,
  stone_giant: `
   _____
  |o   o|
  |  >  |
  |=====|
  |     |
 /|     |\\
 ||=====||
`,

  // ========== TIER 6 (Power 11-13) BOSSES ==========
  adult_dragon: `
     /\\
    /  \\
   / OO \\
  /======\\
 /|      |\\
| |======| |
|_|  ||  |_|
   ~~~~~
`,
  lich: `
   .--.
  ( xx )
   |==|
  /|  |\\
 | |  | |
  \\|  |/
   ~~~~
`,
  vampire_lord: `
  /\\  /\\
 ( O  O )
  \\ vv /
   |==|
  /|  |\\
 | |  | |
  \\|__|/
`,
  beholder: `
    .---.
   /o o o\\
  ( ===== )
   \\^^^^^/
    \\===/ 
     ~~~
`,
  demon_lord: `
  |\\  /|
  | \\/ |
  |O  O|
  | VV |
  |====|
 /|    |\\
 ||====||
`,
  storm_giant: `
   /\\/\\
  /~~~~\\
 | O  O |
 |  >>  |
 |======|
/|  ~~  |\\
||~~~~~~||
||______||
`,

  // ========== FALLBACK ==========
  boss: `
      /\\
     /  \\
    / ** \\
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
