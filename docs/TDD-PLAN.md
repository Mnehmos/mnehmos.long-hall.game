# The Long Hall - TDD Implementation Plan

## Overview

This document outlines a comprehensive Test-Driven Development strategy for The Long Hall. The plan leverages seeded RNG for deterministic testing and follows the Red-Green-Blue TDD cycle.

---

## Testing Stack

| Tool | Purpose | Why |
|------|---------|-----|
| **Vitest** | Unit & integration tests | Fast, TS-native, Vite integration |
| **Playwright** | E2E tests | Cross-browser, reliable |
| **Testing Library** | Component tests | User-centric testing |
| **Happy-DOM** | DOM simulation | Lightweight for unit tests |
| **MSW** | API mocking | Intercept network requests |

---

## Testing Pyramid

```
                    ┌─────────┐
                    │   E2E   │  ← Critical user journeys
                    │  (10%)  │
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              │    Integration      │  ← State + UI interaction
              │       (20%)         │
              └──────────┬──────────┘
                         │
         ┌───────────────┴───────────────┐
         │           Unit Tests          │  ← Pure functions, mechanics
         │             (70%)             │
         └───────────────────────────────┘
```

---

## Test Categories

### 1. Core Mechanics (Unit)

These are pure functions with no side effects - ideal for TDD.

#### 1.1 Dice Rolling

```typescript
// tests/core/dice.test.ts
import { describe, it, expect } from 'vitest';
import { rollDice, parseDiceExpression } from '@/core/dice';
import { createRng } from '@/core/rng';

describe('parseDiceExpression', () => {
  it('parses simple dice notation', () => {
    expect(parseDiceExpression('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it('parses dice with positive modifier', () => {
    expect(parseDiceExpression('1d20+5')).toEqual({ count: 1, sides: 20, modifier: 5 });
  });

  it('parses dice with negative modifier', () => {
    expect(parseDiceExpression('3d8-2')).toEqual({ count: 3, sides: 8, modifier: -2 });
  });

  it('throws on invalid notation', () => {
    expect(() => parseDiceExpression('invalid')).toThrow();
  });
});

describe('rollDice', () => {
  it('returns deterministic results with seeded RNG', () => {
    const rng = createRng('test-seed-123');
    
    const result1 = rollDice('2d6', rng);
    const result2 = rollDice('2d6', rng);
    
    // Reset RNG
    const rng2 = createRng('test-seed-123');
    const result1Again = rollDice('2d6', rng2);
    
    expect(result1).toEqual(result1Again);
    expect(result1).not.toEqual(result2); // Different calls, different results
  });

  it('respects minimum and maximum bounds', () => {
    const rng = createRng('bound-test');
    
    for (let i = 0; i < 100; i++) {
      const result = rollDice('1d20', rng);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    }
  });

  it('applies modifiers correctly', () => {
    const rng = createRng('modifier-test');
    const result = rollDice('1d6+3', rng);
    
    expect(result.modifier).toBe(3);
    expect(result.total).toBe(result.rolls.reduce((a, b) => a + b, 0) + 3);
  });
});
```

#### 1.2 Combat Resolution

```typescript
// tests/engine/combat.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  resolveAttack, 
  calculateDamage, 
  applyDamage,
  isHit 
} from '@/engine/combat';
import { createRng } from '@/core/rng';
import { createMockCharacter, createMockEnemy } from './fixtures';

describe('isHit', () => {
  it('hits when roll + bonus >= AC', () => {
    expect(isHit({ roll: 15, bonus: 3, targetAC: 15 })).toBe(true);
    expect(isHit({ roll: 15, bonus: 3, targetAC: 18 })).toBe(true);
    expect(isHit({ roll: 15, bonus: 3, targetAC: 19 })).toBe(false);
  });

  it('natural 20 always hits', () => {
    expect(isHit({ roll: 20, bonus: -10, targetAC: 30, isNat20: true })).toBe(true);
  });

  it('natural 1 always misses', () => {
    expect(isHit({ roll: 1, bonus: 20, targetAC: 10, isNat1: true })).toBe(false);
  });
});

describe('resolveAttack', () => {
  let rng: () => number;

  beforeEach(() => {
    rng = createRng('attack-test-seed');
  });

  it('returns miss result when attack fails', () => {
    // Seed chosen to produce low roll
    const attacker = createMockCharacter({ attackBonus: 0 });
    const target = createMockEnemy({ ac: 25 }); // Very high AC
    
    // Force low roll by using known seed
    const result = resolveAttack(attacker, target, createRng('miss-seed-001'));
    
    if (!result.hit) {
      expect(result.damage).toBe(0);
    }
  });

  it('applies critical damage on natural 20', () => {
    const attacker = createMockCharacter({ damageBonus: 3 });
    const target = createMockEnemy({ ac: 10 });
    
    // Use seed known to produce nat 20
    const result = resolveAttack(attacker, target, createRng('crit-seed-nat20'));
    
    if (result.isCritical) {
      // Crit doubles dice, not modifier
      expect(result.damage).toBeGreaterThan(attacker.stats.damageBonus);
    }
  });

  it('respects damage resistance', () => {
    const attacker = createMockCharacter({ 
      damageBonus: 5,
      damageType: 'fire' 
    });
    const target = createMockEnemy({ 
      ac: 10,
      resistances: ['fire'] 
    });
    
    const result = resolveAttack(attacker, target, rng);
    
    if (result.hit) {
      // Resistance halves damage
      expect(result.finalDamage).toBe(Math.floor(result.damage / 2));
    }
  });
});

describe('applyDamage', () => {
  it('reduces HP correctly', () => {
    const character = createMockCharacter({ hp: 20, maxHp: 20 });
    const result = applyDamage(character, 5);
    
    expect(result.hp.current).toBe(15);
    expect(result.isAlive).toBe(true);
  });

  it('marks character dead at 0 HP', () => {
    const character = createMockCharacter({ hp: 5, maxHp: 20 });
    const result = applyDamage(character, 10);
    
    expect(result.hp.current).toBe(0);
    expect(result.isAlive).toBe(false);
  });

  it('does not allow negative HP', () => {
    const character = createMockCharacter({ hp: 5, maxHp: 20 });
    const result = applyDamage(character, 100);
    
    expect(result.hp.current).toBe(0);
  });
});
```

#### 1.3 XP and Leveling

```typescript
// tests/engine/xp.test.ts
import { describe, it, expect } from 'vitest';
import { calculateXPGain, checkLevelUp, applyLevelUp } from '@/engine/xp';
import { XP_THRESHOLDS } from '@/config/balance';
import { createMockCharacter } from './fixtures';

describe('calculateXPGain', () => {
  it('awards XP based on enemy level', () => {
    expect(calculateXPGain({ enemyLevel: 1 })).toBe(10);
    expect(calculateXPGain({ enemyLevel: 5 })).toBe(30);
  });

  it('applies party size modifier', () => {
    const baseXP = calculateXPGain({ enemyLevel: 3 });
    const splitXP = calculateXPGain({ enemyLevel: 3, partySize: 4 });
    
    expect(splitXP).toBeLessThan(baseXP);
  });
});

describe('checkLevelUp', () => {
  it('returns true when XP exceeds threshold', () => {
    const character = createMockCharacter({ level: 1, xp: 55 });
    expect(checkLevelUp(character)).toBe(true);
  });

  it('returns false when XP below threshold', () => {
    const character = createMockCharacter({ level: 1, xp: 45 });
    expect(checkLevelUp(character)).toBe(false);
  });

  it('handles max level correctly', () => {
    const character = createMockCharacter({ level: 20, xp: 99999 });
    expect(checkLevelUp(character)).toBe(false);
  });
});

describe('applyLevelUp', () => {
  it('increments level', () => {
    const character = createMockCharacter({ level: 1, xp: 60 });
    const result = applyLevelUp(character);
    
    expect(result.level).toBe(2);
  });

  it('increases max HP', () => {
    const character = createMockCharacter({ level: 1, hp: 10, maxHp: 10 });
    const result = applyLevelUp(character);
    
    expect(result.hp.max).toBeGreaterThan(10);
  });

  it('awards stat point', () => {
    const character = createMockCharacter({ level: 1, statPoints: 0 });
    const result = applyLevelUp(character);
    
    expect(result.statPoints).toBe(1);
  });
});
```

---

### 2. State Management (Integration)

Tests for the reducer and state transitions.

```typescript
// tests/engine/reducer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { reducer, createInitialState } from '@/engine/reducer';
import { createRng } from '@/core/rng';

describe('Game Reducer', () => {
  let initialState: RunState;
  let seed: string;

  beforeEach(() => {
    seed = 'reducer-test-seed';
    initialState = createInitialState(seed);
  });

  describe('ADVANCE_ROOM', () => {
    it('increments depth', () => {
      const state = reducer(initialState, { type: 'ADVANCE_ROOM' });
      expect(state.depth).toBe(1);
    });

    it('generates new room', () => {
      const state = reducer(initialState, { type: 'ADVANCE_ROOM' });
      expect(state.currentRoom).toBeDefined();
      expect(state.currentRoom?.type).toBeDefined();
    });

    it('produces deterministic rooms with same seed', () => {
      const state1 = createInitialState(seed);
      const state2 = createInitialState(seed);

      const after1 = reducer(state1, { type: 'ADVANCE_ROOM' });
      const after2 = reducer(state2, { type: 'ADVANCE_ROOM' });

      expect(after1.currentRoom?.type).toBe(after2.currentRoom?.type);
      expect(after1.currentRoom?.enemies).toEqual(after2.currentRoom?.enemies);
    });
  });

  describe('ATTACK', () => {
    let combatState: RunState;

    beforeEach(() => {
      // Advance to a combat room
      combatState = reducer(initialState, { type: 'ADVANCE_ROOM' });
      // Ensure there are enemies
      if (!combatState.currentRoom?.enemies?.length) {
        combatState = {
          ...combatState,
          currentRoom: {
            ...combatState.currentRoom!,
            type: 'combat',
            enemies: [{ id: 'test-enemy', name: 'Goblin', hp: 8, maxHp: 8, ac: 12 }],
          },
        };
      }
    });

    it('adds attack to history', () => {
      const attackerId = combatState.party.members[0].id;
      const targetId = combatState.currentRoom!.enemies![0].id;

      const state = reducer(combatState, {
        type: 'ATTACK',
        payload: { attackerId, targetId },
      });

      expect(state.history.length).toBeGreaterThan(combatState.history.length);
    });

    it('marks attacker as acted', () => {
      const attackerId = combatState.party.members[0].id;
      const targetId = combatState.currentRoom!.enemies![0].id;

      const state = reducer(combatState, {
        type: 'ATTACK',
        payload: { attackerId, targetId },
      });

      expect(state.actedThisRound).toContain(attackerId);
    });

    it('removes dead enemies', () => {
      // Set enemy to 1 HP for guaranteed kill
      combatState.currentRoom!.enemies![0].hp = 1;
      const attackerId = combatState.party.members[0].id;
      const targetId = combatState.currentRoom!.enemies![0].id;

      // Use seed that produces hit
      const state = reducer(combatState, {
        type: 'ATTACK',
        payload: { attackerId, targetId },
      });

      const enemy = state.currentRoom!.enemies!.find((e) => e.id === targetId);
      if (enemy?.hp === 0) {
        // Enemy should be removed or marked dead
        expect(state.currentRoom!.enemies!.filter((e) => e.hp > 0).length).toBeLessThan(
          combatState.currentRoom!.enemies!.length
        );
      }
    });
  });

  describe('SHORT_REST', () => {
    it('heals party members', () => {
      // Damage a party member
      let state = { ...initialState };
      state.party.members[0].hp.current = 5;
      state.shortRestsRemaining = 2;

      const result = reducer(state, { type: 'SHORT_REST' });

      expect(result.party.members[0].hp.current).toBeGreaterThan(5);
    });

    it('decrements rest counter', () => {
      let state = { ...initialState, shortRestsRemaining: 2 };
      const result = reducer(state, { type: 'SHORT_REST' });

      expect(result.shortRestsRemaining).toBe(1);
    });

    it('does nothing when no rests remaining', () => {
      let state = { ...initialState, shortRestsRemaining: 0 };
      state.party.members[0].hp.current = 5;

      const result = reducer(state, { type: 'SHORT_REST' });

      expect(result.party.members[0].hp.current).toBe(5);
    });
  });
});
```

---

### 3. Snapshot Tests for Generation

Test that procedural generation is deterministic and produces expected structures.

```typescript
// tests/engine/generation.test.ts
import { describe, it, expect } from 'vitest';
import { generateRoom } from '@/engine/generateRoom';
import { createRng } from '@/core/rng';

describe('Room Generation Snapshots', () => {
  it('generates consistent combat room', () => {
    const rng = createRng('combat-room-snapshot');
    const room = generateRoom(5, 'combat', rng);

    expect(room).toMatchSnapshot();
  });

  it('generates consistent elite room', () => {
    const rng = createRng('elite-room-snapshot');
    const room = generateRoom(10, 'elite', rng);

    expect(room).toMatchSnapshot();
  });

  it('generates consistent intermission', () => {
    const rng = createRng('intermission-snapshot');
    const room = generateRoom(10, 'intermission', rng);

    expect(room).toMatchSnapshot();
  });
});

describe('Room Type Distribution', () => {
  it('follows expected distribution over many rooms', () => {
    const rng = createRng('distribution-test');
    const typeCounts: Record<string, number> = {};

    for (let i = 0; i < 1000; i++) {
      const room = generateRoom(i % 10, undefined, rng);
      typeCounts[room.type] = (typeCounts[room.type] || 0) + 1;
    }

    // Combat should be most common
    expect(typeCounts.combat).toBeGreaterThan(typeCounts.shrine || 0);
    expect(typeCounts.combat).toBeGreaterThan(typeCounts.hazard || 0);
    
    // Intermissions at depths 10, 20, 30...
    expect(typeCounts.intermission).toBeGreaterThanOrEqual(90);
  });
});
```

---

### 4. E2E Tests

Full user journey tests with Playwright.

```typescript
// tests/e2e/game-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh game
    await page.goto('/play?seed=e2e-test-seed');
    await page.waitForSelector('.game-container');
  });

  test('can start a new game', async ({ page }) => {
    // Should see starting hero
    await expect(page.locator('.hero-panel')).toBeVisible();
    await expect(page.locator('.stat-depth')).toContainText('Depth: 0');
  });

  test('can advance to first room', async ({ page }) => {
    await page.click('#btn-advance');
    
    await expect(page.locator('.stat-depth')).toContainText('Depth: 1');
    await expect(page.locator('.room-container')).toBeVisible();
  });

  test('can complete combat encounter', async ({ page }) => {
    await page.click('#btn-advance');
    
    // Wait for room to load
    await page.waitForSelector('.room-container');
    
    // If combat room, fight
    const combatPanel = page.locator('.combat-panel');
    if (await combatPanel.isVisible()) {
      // Keep attacking until room resolved
      while (await page.locator('.btn-attack').first().isVisible()) {
        await page.locator('.btn-attack').first().click();
        await page.waitForTimeout(100); // Animation time
      }
      
      // Should see victory or be able to advance
      await expect(
        page.locator('#btn-advance').or(page.locator('.victory-popup'))
      ).toBeVisible();
    }
  });

  test('game over shows correctly', async ({ page }) => {
    // This test uses a seed known to produce difficult early game
    await page.goto('/play?seed=death-seed-123');
    
    await page.click('#btn-advance');
    
    // Wait for potential death
    // ... complex logic to ensure death happens
    
    // Check game over overlay
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.btn-restart')).toBeVisible();
  });

  test('leaderboard submission works', async ({ page }) => {
    // Requires auth mock setup
    await page.route('/api/scores', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Simulate game over with score
    // ... game logic

    // Check score submitted
    await expect(page.locator('.highscores-panel')).toBeVisible();
  });
});
```

---

### 5. Component Tests (Astro)

After migration, test individual components.

```typescript
// tests/components/StatBar.test.ts
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import StatBar from '@/components/shared/StatBar.astro';

describe('StatBar Component', () => {
  it('renders HP bar correctly', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(StatBar, {
      props: {
        current: 15,
        max: 20,
        type: 'hp',
      },
    });

    expect(result).toContain('75%'); // width percentage
    expect(result).toContain('15/20');
    expect(result).toContain('hp-bar');
  });

  it('shows danger color at low HP', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(StatBar, {
      props: {
        current: 3,
        max: 20,
        type: 'hp',
      },
    });

    expect(result).toContain('danger'); // CSS class
  });

  it('handles zero max gracefully', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(StatBar, {
      props: {
        current: 0,
        max: 0,
        type: 'hp',
      },
    });

    expect(result).not.toContain('NaN');
    expect(result).not.toContain('Infinity');
  });
});
```

---

## Test Fixtures

```typescript
// tests/fixtures/index.ts
import type { PartyMember, Enemy, Item } from '@/engine/types';

export function createMockCharacter(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    id: `mock-char-${Math.random().toString(36).slice(2)}`,
    name: 'Test Hero',
    role: 'fighter',
    level: 1,
    xp: 0,
    hp: { current: 20, max: 20 },
    isAlive: true,
    skills: {
      strength: 2,
      attack: 1,
      defense: 1,
      magic: 0,
      ranged: 0,
      faith: 0,
      agility: 1,
    },
    equipment: {},
    abilities: [],
    statuses: [],
    statPoints: 0,
    ...overrides,
  };
}

export function createMockEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: `mock-enemy-${Math.random().toString(36).slice(2)}`,
    name: 'Test Goblin',
    hp: 8,
    maxHp: 8,
    ac: 12,
    attackBonus: 2,
    damage: '1d6',
    xpValue: 10,
    ...overrides,
  };
}

export function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: `mock-item-${Math.random().toString(36).slice(2)}`,
    name: 'Test Sword',
    type: 'main_hand',
    rarity: 'common',
    cost: 20,
    baseStats: {
      attackBonus: 1,
      damageBonus: 2,
    },
    ...overrides,
  };
}
```

---

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:unit
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Coverage Goals

| Category | Target | Priority |
|----------|--------|----------|
| Core mechanics (dice, combat math) | 95% | Critical |
| State reducer | 90% | Critical |
| Room generation | 80% | High |
| Abilities & effects | 85% | High |
| UI rendering | 60% | Medium |
| E2E critical paths | 100% coverage of happy paths | Critical |

---

## TDD Workflow

### Red Phase
1. Write failing test for new feature/fix
2. Test should fail with meaningful message
3. Commit: `test(combat): add test for resistance calculation`

### Green Phase
1. Write minimal code to pass test
2. No extra functionality
3. Commit: `feat(combat): implement resistance calculation`

### Blue Phase
1. Refactor while tests stay green
2. Improve code quality
3. Commit: `refactor(combat): extract resistance logic to helper`

---

## Related Documents

- [ARCHITECTURE-ANALYSIS.md](./ARCHITECTURE-ANALYSIS.md) - Current state analysis
- [WISH-LIST-ASTRO.md](./WISH-LIST-ASTRO.md) - Desired improvements
- [WISH-WAS-DIFFERENT.md](./WISH-WAS-DIFFERENT.md) - Retrospective
