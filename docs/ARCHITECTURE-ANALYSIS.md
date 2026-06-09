# The Long Hall - Architecture Analysis

## Overview

The Long Hall is a roguelike dungeon crawler built with TypeScript, Vite, and Clerk authentication. This document analyzes the current architecture, identifies strengths, and documents areas for improvement.

---

## Current Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Build | Vite | Fast dev server, bundling |
| Language | TypeScript | Type safety |
| Auth | Clerk | User authentication |
| State | Custom Reducer | Game state management |
| RNG | Seeded Alea | Deterministic procedural generation |
| Rendering | HTML Templates | String concatenation → DOM |
| Styling | Vanilla CSS | Dark theme, mobile responsive |
| Backend | External API | Leaderboards, score persistence |

---

## Directory Structure

```
src/
├── api/           # External API client
│   └── client.ts
├── content/       # Game content definitions
│   ├── abilities.ts
│   ├── art.ts         # ASCII art for heroes/enemies
│   ├── classes.ts
│   ├── tables.ts      # Items, enemies, shrines
│   └── themes.ts
├── core/          # Core utilities
│   ├── dice.ts        # Dice rolling
│   ├── hash.ts        # Deterministic hashing
│   └── rng.ts         # Seeded RNG (Alea)
├── engine/        # Game logic
│   ├── combat.ts
│   ├── combatHelpers.ts
│   ├── generateRoom.ts
│   ├── generateTheme.ts
│   ├── loot.ts
│   ├── reducer.ts     # State reducer
│   ├── resolveRoom.ts
│   ├── rest.ts
│   ├── score.ts
│   ├── state.ts       # Initial state creation
│   └── types.ts       # Core type definitions
├── ui/            # User interface
│   ├── input.ts       # Event handlers
│   ├── leaderboard.ts
│   └── render.ts      # Main render function (~1000 lines)
├── auth.ts        # Clerk initialization
├── main.ts        # Entry point
└── style.css      # Global styles (~2000 lines)
```

---

## Architecture Patterns

### 1. Reducer-Based State Management

**Pattern**: All game state flows through a single reducer function.

```typescript
// engine/reducer.ts
export function reducer(state: RunState, action: GameAction): RunState {
  switch (action.type) {
    case 'ADVANCE_ROOM':
      return advanceRoom(state);
    case 'ATTACK':
      return handleAttack(state, action.payload);
    // ... other actions
  }
}
```

**Strengths**:
- Predictable state transitions
- Easy to debug (log actions)
- Enables undo/replay
- Centralized logic

**Weaknesses**:
- Large switch statement
- Some actions are overly broad
- No middleware for side effects

---

### 2. Seeded Procedural Generation

**Pattern**: Deterministic RNG seeded at run start.

```typescript
// core/rng.ts - Alea PRNG
export function createRng(seed: string): () => number {
  // Alea algorithm implementation
}

// engine/state.ts
const seed = crypto.randomUUID();
const rng = createRng(seed);
```

**Strengths**:
- Reproducible runs for debugging
- Share seeds for challenge runs
- Consistent testing
- True randomness appearance

**Weaknesses**:
- State must track seed
- Care needed with RNG consumption order

---

### 3. Content Tables

**Pattern**: Game content defined as TypeScript constants.

```typescript
// content/tables.ts
export const ITEMS: Item[] = [
  { id: 'iron_sword', name: 'Iron Sword', type: 'main_hand', ... },
  { id: 'leather_armor', name: 'Leather Armor', type: 'chest', ... },
];

export const ENEMIES: EnemyTemplate[] = [
  { id: 'goblin', name: 'Goblin', hp: 8, ac: 12, ... },
];
```

**Strengths**:
- Type-safe content
- IDE autocomplete
- Compile-time validation

**Weaknesses**:
- Requires rebuild for content changes
- Content designers need TypeScript knowledge
- Harder to localize

---

### 4. String Template Rendering

**Pattern**: UI rendered via template literal functions.

```typescript
// ui/render.ts
export function renderGame(state: RunState): string {
  let html = `
    <div class="header">
      <h1>The Long Hall</h1>
      <div class="stats">
        <span class="stat-depth">🗺️ Depth: ${state.depth}</span>
        ...
      </div>
    </div>
  `;
  
  html += renderSidebar(state);
  html += renderMainContent(state);
  // ...
  
  return html;
}
```

**Strengths**:
- Simple, no framework dependency
- Fast initial render
- Easy to understand

**Weaknesses**:
- No reactive updates (full re-render)
- Poor separation of concerns
- Large monolithic render function
- XSS risk if user input not escaped
- No component reusability

---

### 5. ASCII Art

**Pattern**: Character visuals as multi-line strings.

```typescript
// content/art.ts
export function getHeroArt(role: string): string {
  switch (role) {
    case 'fighter':
      return `
    ╔═══╗
    ║ ⚔ ║
    ╠═══╣
    ║   ║
    ╚═══╝`;
    // ...
  }
}
```

**Strengths**:
- Retro aesthetic
- Lightweight
- Works everywhere

**Weaknesses**:
- Limited expressiveness
- Fixed size/resolution
- Can't animate smoothly
- Monospace font required
- Accessibility challenges

---

## State Flow

```
┌─────────────────────────────────────────────────────────┐
│                     User Interaction                     │
│                    (click, keyboard)                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   input.ts (Event Handler)              │
│                                                         │
│  - Parse event target (data-* attributes)               │
│  - Construct action object                              │
│  - Dispatch to reducer                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    reducer.ts (State)                   │
│                                                         │
│  - Match action type                                    │
│  - Call appropriate handler                             │
│  - Return new state (immutable)                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   render.ts (View)                      │
│                                                         │
│  - Receive new state                                    │
│  - Generate HTML string                                 │
│  - Set innerHTML on #app                                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                     DOM (Browser)                       │
│                                                         │
│  - Full DOM replacement                                 │
│  - Event delegation re-registered                       │
└─────────────────────────────────────────────────────────┘
```

---

## Combat System

The combat system follows D&D 5e-style mechanics:

1. **Initiative**: Dexterity-based turn order
2. **Attack Roll**: d20 + attack bonus vs AC
3. **Damage Roll**: Weapon dice + damage bonus
4. **Abilities**: Per-rest and cooldown-based powers
5. **Conditions**: Buffs/debuffs with duration

```typescript
interface CombatState {
  round: number;
  actedThisRound: string[];  // Character IDs
  initiativeOrder: string[];
  extraActions?: number;     // From abilities like Action Surge
}
```

---

## Equipment System

Multi-slot paper doll with mastery tracking:

```typescript
interface Equipment {
  head?: Item;
  neck?: Item;
  chest?: Item;
  main_hand?: Item;
  off_hand?: Item;
  ring1?: Item;
  ring2?: Item;
  legs?: Item;
  feet?: Item;
}

interface Item {
  id: string;
  name: string;
  customName?: string;  // Player-given name
  type: EquipmentSlot;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'godly';
  baseStats: ItemStats;
  enchantment?: Enchantment;
  stats?: ItemMasteryStats;  // Kills, damage dealt, etc.
  history?: string[];        // Notable events
}
```

---

## Strengths Summary

| Area | Strength | Impact |
|------|----------|--------|
| **Architecture** | Clean separation (engine/content/ui) | Maintainable |
| **State** | Reducer pattern | Predictable |
| **RNG** | Seeded Alea | Reproducible |
| **Content** | Type-safe tables | Compile-time safety |
| **Mobile** | Responsive CSS | Cross-device play |
| **Auth** | Clerk integration | Easy authentication |
| **Combat** | D&D-style mechanics | Familiar, deep |
| **Items** | Mastery tracking | Player investment |

---

## Weaknesses Summary

| Area | Weakness | Impact |
|------|----------|--------|
| **Rendering** | Full DOM replacement | Poor performance |
| **Art** | ASCII only | Limited expression |
| **Components** | Monolithic render.ts | Hard to maintain |
| **Testing** | No tests | Regression risk |
| **Content** | TS-only definitions | Designer friction |
| **Styles** | Single CSS file | Organization |
| **Accessibility** | Limited ARIA | Screen reader issues |
| **Animations** | CSS-only | Limited capability |

---

## Complexity Metrics

| File | Lines | Complexity |
|------|-------|------------|
| render.ts | ~1000 | High - many branches |
| style.css | ~2000 | Medium - well organized |
| reducer.ts | ~300 | Medium - switch statement |
| tables.ts | ~400 | Low - data definitions |
| combat.ts | ~250 | Medium - D&D rules |
| types.ts | ~200 | Low - pure types |

---

## Recommendations for Astro Refactor

1. **Break render.ts into components** (see WISH-LIST-ASTRO.md)
2. **Migrate ASCII to SVG** (see WISH-LIST-ASTRO.md)
3. **Add component tests** (see TDD-PLAN.md)
4. **Extract content to JSON/YAML**
5. **Use Astro islands for interactivity**
6. **Implement proper accessibility**

---

## Related Documents

- [WISH-LIST-ASTRO.md](./WISH-LIST-ASTRO.md) - Desired improvements for Astro migration
- [WISH-WAS-DIFFERENT.md](./WISH-WAS-DIFFERENT.md) - Retrospective on initial decisions
- [TDD-PLAN.md](./TDD-PLAN.md) - Testing strategy
