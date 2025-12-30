# The Long Hall - Knowledge Base Document

## Quick Reference

| Property | Value |
|----------|-------|
| **Repository** | https://github.com/Mnehmos/mnehmos.long-hall.game |
| **Primary Language** | TypeScript |
| **Project Type** | Game |
| **Status** | Active |
| **Last Updated** | 2025-12-29 |

## Overview

The Long Hall is a browser-based procedural roguelike dungeon crawler featuring turn-based combat, ironman auto-saves, and cloud leaderboards. Players lead a party of adventurers through an endless procedurally-generated dungeon with D&D-inspired mechanics including attack rolls, damage dice, and character classes with unique abilities. Each run is generated from a seeded RNG to ensure reproducible gameplay for speedrunning and competitive play.

## Architecture

### System Design

The Long Hall is a full-stack web application following a client-server architecture. The frontend is a single-page application built with Vite and TypeScript that runs entirely in the browser, with game state managed through a Redux-like reducer pattern. The backend is an Express server providing authenticated REST endpoints for cloud saves and leaderboard functionality. Clerk handles authentication using JWT tokens, and PostgreSQL stores persistent data including high scores and save files.

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| Main Entry | Application initialization, event handling, game loop | `src/main.ts` |
| Game Reducer | State management, action dispatch, game logic orchestration | `src/engine/reducer.ts` |
| State Manager | Save/load operations, initial state creation | `src/engine/state.ts` |
| Combat Engine | Turn-based combat, attack resolution, damage calculation | `src/engine/combat.ts` |
| Room Generator | Procedural room generation with seeded RNG | `src/engine/generateRoom.ts` |
| Dice System | D&D-style dice rolling with advantage/disadvantage | `src/core/dice.ts` |
| Seeded RNG | Deterministic random number generation | `src/core/rng.ts` |
| Character Classes | Class definitions, starting skills, hit dice | `src/content/classes.ts` |
| Abilities | Class-specific abilities with cooldowns | `src/content/abilities.ts` |
| UI Renderer | DOM rendering, game visualization | `src/ui/render.ts` |
| API Client | Backend communication for saves and scores | `src/api/client.ts` |
| Auth Module | Clerk integration, token management | `src/auth.ts` |
| Server Entry | Express server, middleware, database initialization | `server/src/index.ts` |
| Database Layer | PostgreSQL connection pool, schema initialization | `server/src/db/` |
| Scores Routes | Leaderboard endpoints, score submission | `server/src/routes/scores.ts` |
| Saves Routes | Cloud save CRUD operations | `server/src/routes/saves.ts` |

### Data Flow

```
User Input → Event Listener (main.ts)
           → dispatch(Action)
           → gameReducer (reducer.ts)
           → Updated State
           → saveGameState (localStorage)
           → syncSave (API client)
           → Backend (Express + PostgreSQL)
           → renderGame (UI update)
           → DOM

Procedural Generation Flow:
Seed → hashWithSeed → SeededRNG → generateRoom → Room State
                                → Combat Encounters
                                → Loot Tables
                                → Enemy Stats

Combat Flow:
Player Turn → ATTACK Action → combat.ts → roll('1d20+modifier')
           → Compare vs Enemy AC → Damage roll → Update HP
           → Check Death → Award XP/Loot
Enemy Turn → resolveEnemyTurn → Target selection → Attack roll → Damage
```

## API Surface

### Public Interfaces

#### Action: `START_RUN`
- **Purpose**: Initialize a new game run with the given seed
- **Parameters**:
  - `seed` (string): RNG seed for deterministic generation
- **Returns**: New RunState with starting room, hero, and equipment

#### Action: `ADVANCE_ROOM`
- **Purpose**: Progress to the next procedurally-generated room
- **Parameters**: None
- **Returns**: Updated state with new current room

#### Action: `ATTACK`
- **Purpose**: Execute a melee or ranged attack against a target
- **Parameters**:
  - `attackerId` (string): ID of the attacking actor
  - `targetId` (string): ID of the target enemy
- **Returns**: Updated state with damage applied, combat log entries

#### Action: `USE_ABILITY`
- **Purpose**: Activate a character class ability
- **Parameters**:
  - `actorId` (string): ID of the actor using the ability
  - `abilityId` (string): ID of the ability to use
  - `targetId?` (string): Optional target for targeted abilities
- **Returns**: Updated state with ability effects applied, cooldown set

#### Action: `EQUIP_ITEM`
- **Purpose**: Equip an item from inventory to a character slot
- **Parameters**:
  - `actorId` (string): ID of the actor equipping the item
  - `itemId` (string): ID of the item to equip
  - `slot?` (EquipmentSlot): Optional specific slot to equip to
- **Returns**: Updated state with item equipped, stats recalculated

#### Action: `TAKE_SHORT_REST`
- **Purpose**: Spend hit dice to heal party members
- **Parameters**:
  - `actorIdsToHeal` (string[]): Array of actor IDs to heal
- **Returns**: Updated state with HP restored, rest count decremented

#### Function: `roll(expression, rng?)`
- **Purpose**: Roll dice using D&D notation with optional seeded RNG
- **Parameters**:
  - `expression` (string): Dice expression like "2d6+3", "1d20adv", "4d8-2"
  - `rng?` (object): Optional RNG with int(min, max) method
- **Returns**: `{ total: number, rolls: number[], modifier: number, keptRolls?: number[] }`

#### Function: `createActor(id, name, role, level, includeEquipment)`
- **Purpose**: Create a new actor (player character or recruit) with specified role
- **Parameters**:
  - `id` (string): Unique actor identifier
  - `name` (string): Actor display name
  - `role` (Role): Character class ('fighter' | 'wizard' | 'rogue' | 'cleric' | 'ranger')
  - `level` (number): Starting level (default 1)
  - `includeEquipment` (boolean): Auto-equip starter gear (default false)
- **Returns**: Actor object with stats, skills, HP, equipment slots

#### API Endpoint: `POST /api/scores`
- **Purpose**: Submit high score to leaderboard (authenticated)
- **Parameters**:
  - `runData` (RunState): Complete game state at death
  - `displayName` (string): Player display name
- **Returns**: `{ success: boolean }`

#### API Endpoint: `GET /api/scores`
- **Purpose**: Retrieve leaderboard entries
- **Parameters**:
  - `limit?` (number): Number of entries to return (default 10)
  - `category?` (string): 'score' | 'depth' | 'gold' | 'kills' | 'hit' | 'crits' | 'level'
- **Returns**: Array of ScoreEntry objects

#### API Endpoint: `POST /api/saves`
- **Purpose**: Save game state to cloud (authenticated)
- **Parameters**:
  - `state` (RunState): Current game state to persist
- **Returns**: `{ success: boolean, hash?: string }`

#### API Endpoint: `GET /api/saves`
- **Purpose**: Load saved game state from cloud (authenticated)
- **Parameters**: None (user ID from JWT)
- **Returns**: `{ state: RunState }` or 404 if no save exists

### Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | string | (required) | Clerk authentication publishable key |
| `VITE_API_URL` | string | `https://the-long-hall-production.up.railway.app` | Backend API base URL |
| `CLERK_SECRET_KEY` | string | (required) | Clerk authentication secret key (server) |
| `DATABASE_URL` | string | (required) | PostgreSQL connection string |
| `PORT` | number | `3000` | Server listening port |

## Usage Examples

### Basic Usage

```typescript
// Rolling dice with D&D notation
import { roll } from './core/dice';

// Standard roll: 2d6+3
const result = roll('2d6+3');
console.log(`Rolled ${result.total} (${result.rolls.join(', ')} + ${result.modifier})`);

// Roll with advantage (2d20, keep highest)
const attackRoll = roll('1d20adv');
console.log(`Attack roll: ${attackRoll.total} (rolled ${attackRoll.rolls.join(' and ')}, kept ${attackRoll.keptRolls[0]})`);

// Creating a character
import { createActor } from './engine/state';

const fighter = createActor('hero-1', 'Aragorn', 'fighter', 1, true);
console.log(`Created ${fighter.name}, a level ${fighter.level} ${fighter.role}`);
console.log(`HP: ${fighter.hp.current}/${fighter.hp.max}`);
console.log(`Skills: STR ${fighter.skills.strength}, ATK ${fighter.skills.attack}`);
```

### Advanced Patterns

```typescript
// Procedural generation with seeded RNG
import { SeededRNG } from './core/rng';
import { hashWithSeed } from './core/hash';

const seed = 'speedrun-123';
const roomNumber = 5;
const rng = new SeededRNG(hashWithSeed(seed, roomNumber));

// Generate deterministic enemy stats
const enemyHP = rng.int(10, 20); // Always same HP for room 5 with seed 'speedrun-123'
const enemyDamage = `${rng.int(1, 2)}d6+${rng.int(0, 3)}`;

// State management with reducer pattern
import { gameReducer } from './engine/reducer';
import { createInitialRunState } from './engine/state';

let state = createInitialRunState('my-seed-123');

// Dispatch actions to update state
state = gameReducer(state, { type: 'ADVANCE_ROOM' });
state = gameReducer(state, {
  type: 'ATTACK',
  attackerId: 'hero-1',
  targetId: 'enemy-1'
});

// Check combat result
if (state.currentRoom?.enemies.every(e => e.hp <= 0)) {
  console.log('All enemies defeated!');
  state = gameReducer(state, { type: 'RESOLVE_ROOM' });
}
```

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @clerk/clerk-js | ^5.117.0 | Client-side authentication and session management |
| @clerk/clerk-sdk-node | ^4.13.23 | Server-side Clerk SDK for JWT verification |
| @clerk/express | ^1.0.0 | Express middleware for Clerk authentication |
| express | ^4.21.0 | Backend REST API server framework |
| cors | ^2.8.5 | Cross-origin resource sharing middleware |
| pg | ^8.13.0 | PostgreSQL database client |
| dotenv | ^17.2.3 | Environment variable loading |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ~5.9.3 (frontend), ^5.6.0 (backend) | TypeScript compiler and type checking |
| vite | ^7.2.4 | Frontend build tool and dev server |
| vitest | ^4.0.16 | Unit testing framework |
| @vitest/ui | ^4.0.16 | Vitest browser UI |
| @types/express | ^4.17.21 | TypeScript types for Express |
| @types/pg | ^8.11.10 | TypeScript types for PostgreSQL |
| @types/cors | ^2.8.17 | TypeScript types for CORS |
| @types/node | ^22.0.0 | TypeScript types for Node.js |
| tsx | ^4.19.0 | TypeScript execution and REPL |

## Integration Points

### Works With

Standalone project - no direct Mnehmos integrations

### External Services

| Service | Purpose | Required |
|---------|---------|----------|
| Clerk | User authentication, JWT token generation, session management | Yes |
| PostgreSQL | Persistent storage for saves and leaderboard scores | Yes |
| Railway | Backend hosting and deployment platform | No (can self-host) |
| GitHub Pages | Frontend static site hosting | No (can deploy elsewhere) |
| OpenAI | None (no AI integration) | No |

## Development Guide

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (for backend development)
- Clerk account with API keys

### Setup

```bash
# Clone the repository
git clone https://github.com/Mnehmos/mnehmos.long-hall.game
cd mnehmos.long-hall.game

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install

# Set up environment variables for backend
cp .env.example .env
# Edit .env with your Clerk keys and PostgreSQL URL:
#   CLERK_SECRET_KEY=sk_test_...
#   DATABASE_URL=postgresql://user:pass@localhost:5432/longhall
#   PORT=3000

# Initialize database schema
npm run db:init
```

### Running Locally

```bash
# Frontend development mode (from project root)
npm run dev
# Starts Vite dev server at http://localhost:5173

# Backend development mode (from server/ directory)
cd server
npm run dev
# Starts Express server at http://localhost:3000 with hot reload

# Production build
npm run build
# Output: dist/ directory with compiled assets
```

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test -- --ui

# Run specific test file
npm test tests/core.dice.test.ts

# Watch mode
npm test -- --watch
```

### Building

```bash
# Build frontend for production
npm run build
# Output: dist/ directory

# Build backend for production
cd server
npm run build
# Output: server/dist/ directory

# Preview production build locally
npm run preview
```

## Maintenance Notes

### Known Issues

1. Cloud save sync is fire-and-forget - failures are logged but not surfaced to users
2. History array can grow unbounded in very long runs (capped at 100 client-side, 50 server-side)
3. Mobile tooltip system intercepts some button clicks on narrow screens
4. No offline mode - leaderboard features require internet connection

### Future Considerations

1. Add more character classes beyond the current five (Barbarian, Paladin, Bard, etc.)
2. Implement meta-progression system (persistent unlocks between runs)
3. Add daily challenge mode with fixed seed rotation
4. Expand item enchantment system with set bonuses and unique legendary effects
5. Add sound effects and background music
6. Implement party formations and positioning mechanics
7. Add boss-specific attack patterns and phases

### Code Quality

| Metric | Status |
|--------|--------|
| Tests | Partial coverage on core systems (dice, RNG, hash, room generation) |
| Linting | None configured |
| Type Safety | TypeScript strict mode enabled |
| Documentation | JSDoc comments on key functions, README comprehensive |

---

## Appendix: File Structure

```
mnehmos.long-hall.game/
├── src/                          # Frontend source code
│   ├── api/
│   │   └── client.ts            # Backend API client
│   ├── content/
│   │   ├── abilities.ts         # Class abilities and cooldown definitions
│   │   ├── art.ts               # ASCII art and visual themes
│   │   ├── classes.ts           # Character class stats and hit dice
│   │   ├── tables.ts            # Loot tables, items, enemy definitions
│   │   └── themes.ts            # Dungeon theme configurations
│   ├── core/
│   │   ├── dice.ts              # D&D dice rolling system
│   │   ├── hash.ts              # Seed hashing utilities
│   │   └── rng.ts               # Seeded random number generator
│   ├── engine/
│   │   ├── combat.ts            # Combat resolution logic
│   │   ├── combatHelpers.ts    # Enemy AI and turn resolution
│   │   ├── generateRoom.ts     # Procedural room generation
│   │   ├── generateTheme.ts    # Theme selection logic
│   │   ├── loot.ts              # Item drop and rarity systems
│   │   ├── reducer.ts           # State reducer (Redux-like pattern)
│   │   ├── resolveRoom.ts      # Room completion handlers
│   │   ├── rest.ts              # Short/long rest mechanics
│   │   ├── score.ts             # Score calculation
│   │   ├── state.ts             # State creation, save/load
│   │   └── types.ts             # TypeScript type definitions
│   ├── ui/
│   │   ├── input.ts             # Input handling
│   │   ├── leaderboard.ts      # Leaderboard rendering
│   │   └── render.ts            # Main game UI renderer
│   ├── auth.ts                  # Clerk authentication integration
│   ├── counter.ts               # Example counter (unused)
│   └── main.ts                  # Application entry point
├── server/                       # Backend source code
│   └── src/
│       ├── db/
│       │   ├── index.ts         # PostgreSQL connection pool
│       │   └── init.ts          # Database schema initialization
│       ├── engine/
│       │   ├── score.ts         # Server-side score calculation
│       │   └── types.ts         # Backend type definitions
│       ├── routes/
│       │   ├── saves.ts         # /api/saves endpoints
│       │   └── scores.ts        # /api/scores endpoints
│       ├── utils/
│       │   └── hash.ts          # Hash utilities (shared with client)
│       └── index.ts             # Express server entry point
├── tests/                        # Test suite
│   ├── core.dice.test.ts        # Dice rolling tests
│   ├── core.hash.test.ts        # Hash function tests
│   ├── core.rng.test.ts         # RNG determinism tests
│   ├── engine.generateRoom.test.ts # Room generation tests
│   └── engine.inventory.test.ts # Inventory system tests
├── public/                       # Static assets
│   └── favicon.ico
├── .github/workflows/            # CI/CD configuration
│   └── deploy.yml               # GitHub Pages deployment
├── package.json                  # Frontend dependencies
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
├── vitest.config.ts              # Vitest test configuration
├── index.html                    # HTML entry point
├── README.md                     # User-facing documentation
└── PROJECT_KNOWLEDGE.md          # This document
```

---

*Generated by Project Review Orchestrator | 2025-12-29*
*Source: https://github.com/Mnehmos/mnehmos.long-hall.game*
