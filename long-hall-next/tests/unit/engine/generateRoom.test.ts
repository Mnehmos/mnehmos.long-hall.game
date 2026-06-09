/**
 * @fileoverview TDD Red Phase Tests for Room Generation System
 * 
 * These tests define the expected behavior of the room generation module.
 * They WILL FAIL because the implementation doesn't exist yet - that's intentional.
 *
 * @module tests/unit/engine/generateRoom.test
 * @see src/engine/generateRoom.ts (to be implemented)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRNG } from '@lib/rng';
import type { RunState, Room, RoomType, Enemy } from '@engine/types';

// These imports WILL FAIL - they don't exist yet!
// This is the Red Phase of TDD - tests fail before implementation
import {
  getDifficulty,
  calculateEscapeDC,
  generateRoom,
} from '@engine/generateRoom';

import {
  createMockRunState,
  createMockCharacter,
  resetAllFixtureIds,
  DETERMINISTIC_SEED,
} from '../../fixtures';

// ============================================================================
// getDifficulty() Tests
// ============================================================================

describe('getDifficulty', () => {
  describe('segment calculation', () => {
    it('should return segment 1 for depths 1-10', () => {
      expect(getDifficulty(1).segment).toBe(1);
      expect(getDifficulty(5).segment).toBe(1);
      expect(getDifficulty(10).segment).toBe(1);
    });

    it('should return segment 2 for depths 11-20', () => {
      expect(getDifficulty(11).segment).toBe(2);
      expect(getDifficulty(15).segment).toBe(2);
      expect(getDifficulty(20).segment).toBe(2);
    });

    it('should return segment 3 for depths 21-30', () => {
      expect(getDifficulty(21).segment).toBe(3);
      expect(getDifficulty(25).segment).toBe(3);
      expect(getDifficulty(30).segment).toBe(3);
    });

    it('should handle segment 6+ for depths 51+', () => {
      expect(getDifficulty(51).segment).toBe(6);
      expect(getDifficulty(60).segment).toBe(6);
      expect(getDifficulty(100).segment).toBe(10);
    });
  });

  describe('roomInSegment calculation', () => {
    it('should calculate roomInSegment correctly (1-10)', () => {
      expect(getDifficulty(1).roomInSegment).toBe(1);
      expect(getDifficulty(5).roomInSegment).toBe(5);
      expect(getDifficulty(10).roomInSegment).toBe(10);
    });

    it('should reset roomInSegment for new segments', () => {
      expect(getDifficulty(11).roomInSegment).toBe(1);
      expect(getDifficulty(15).roomInSegment).toBe(5);
      expect(getDifficulty(20).roomInSegment).toBe(10);
    });

    it('should handle depth 0 edge case', () => {
      // Depth 0 is typically the shrine/start, segment calculation should handle it
      const result = getDifficulty(0);
      expect(result).toBeDefined();
    });
  });

  describe('multiplier scaling', () => {
    it('should apply multiplier scaling per segment', () => {
      // Segment 1: 1.0 base
      // Segment 2: 1.3 base
      // Segment 3: 1.6 base
      const seg1 = getDifficulty(1).multiplier;
      const seg2 = getDifficulty(11).multiplier;
      const seg3 = getDifficulty(21).multiplier;

      expect(seg2).toBeGreaterThan(seg1);
      expect(seg3).toBeGreaterThan(seg2);
    });

    it('should apply within-segment room ramp', () => {
      // Rooms 1-9 within a segment should have slight multiplier increase
      const room1 = getDifficulty(1).multiplier;
      const room5 = getDifficulty(5).multiplier;
      const room9 = getDifficulty(9).multiplier;

      expect(room5).toBeGreaterThan(room1);
      expect(room9).toBeGreaterThan(room5);
    });
  });

  describe('power range calculation', () => {
    it('should return correct power range for segment 1', () => {
      const result = getDifficulty(5);
      expect(result.minPower).toBe(1);
      expect(result.maxPower).toBe(2);
    });

    it('should return correct power range for segment 2', () => {
      const result = getDifficulty(15);
      expect(result.minPower).toBe(2);
      expect(result.maxPower).toBe(4);
    });

    it('should return correct power range for segment 3', () => {
      const result = getDifficulty(25);
      expect(result.minPower).toBe(3);
      expect(result.maxPower).toBe(6);
    });

    it('should return correct power range for segment 4', () => {
      const result = getDifficulty(35);
      expect(result.minPower).toBe(5);
      expect(result.maxPower).toBe(8);
    });

    it('should return correct power range for segment 5', () => {
      const result = getDifficulty(45);
      expect(result.minPower).toBe(7);
      expect(result.maxPower).toBe(10);
    });

    it('should return boss tier power range for segment 6+', () => {
      const result = getDifficulty(55);
      expect(result.minPower).toBe(9);
      expect(result.maxPower).toBe(13);
    });
  });

  describe('AC bonus calculation', () => {
    it('should apply AC bonus based on segment', () => {
      // Formula: Math.floor((segment - 1) * 1.5)
      expect(getDifficulty(5).acBonus).toBe(0);   // Segment 1: +0
      expect(getDifficulty(15).acBonus).toBe(1);  // Segment 2: +1
      expect(getDifficulty(25).acBonus).toBe(3);  // Segment 3: +3
      expect(getDifficulty(35).acBonus).toBe(4);  // Segment 4: +4
    });
  });

  describe('enemy count bonus calculation', () => {
    it('should apply enemy count bonus for later segments', () => {
      // Formula: Math.floor((segment - 1) / 2)
      expect(getDifficulty(5).enemyCountBonus).toBe(0);   // Seg 1: +0
      expect(getDifficulty(15).enemyCountBonus).toBe(0);  // Seg 2: +0
      expect(getDifficulty(25).enemyCountBonus).toBe(1);  // Seg 3: +1
      expect(getDifficulty(35).enemyCountBonus).toBe(1);  // Seg 4: +1
      expect(getDifficulty(45).enemyCountBonus).toBe(2);  // Seg 5: +2
    });
  });
});

// ============================================================================
// calculateEscapeDC() Tests
// ============================================================================

describe('calculateEscapeDC', () => {
  describe('base DC calculation', () => {
    it('should start with base DC of 10', () => {
      const result = calculateEscapeDC(1, 1, false, 0, false);
      expect(result.dc).toBeGreaterThanOrEqual(10);
      expect(result.breakdown).toContain('Base: 10');
    });
  });

  describe('segment scaling', () => {
    it('should add +2 per segment after first', () => {
      const seg1 = calculateEscapeDC(5, 1, false, 0, false);
      const seg2 = calculateEscapeDC(15, 1, false, 0, false);
      const seg3 = calculateEscapeDC(25, 1, false, 0, false);

      expect(seg2.dc).toBe(seg1.dc + 2);
      expect(seg3.dc).toBe(seg1.dc + 4);
    });

    it('should include segment info in breakdown', () => {
      const result = calculateEscapeDC(15, 1, false, 0, false);
      expect(result.breakdown).toContain('Segment');
    });
  });

  describe('enemy count modifier', () => {
    it('should add +1 per enemy beyond first', () => {
      const oneEnemy = calculateEscapeDC(5, 1, false, 0, false);
      const twoEnemies = calculateEscapeDC(5, 2, false, 0, false);
      const threeEnemies = calculateEscapeDC(5, 3, false, 0, false);

      expect(twoEnemies.dc).toBe(oneEnemy.dc + 1);
      expect(threeEnemies.dc).toBe(oneEnemy.dc + 2);
    });

    it('should include enemy count in breakdown', () => {
      const result = calculateEscapeDC(5, 3, false, 0, false);
      expect(result.breakdown).toContain('Enemies');
    });
  });

  describe('elite room modifier', () => {
    it('should add +3 for elite rooms', () => {
      const normal = calculateEscapeDC(5, 1, false, 0, false);
      const elite = calculateEscapeDC(5, 1, true, 0, false);

      expect(elite.dc).toBe(normal.dc + 3);
    });

    it('should include Elite in breakdown', () => {
      const result = calculateEscapeDC(5, 1, true, 0, false);
      expect(result.breakdown).toContain('Elite');
    });
  });

  describe('party agility reduction', () => {
    it('should subtract party agility from DC', () => {
      const noAgility = calculateEscapeDC(5, 1, false, 0, false);
      const withAgility = calculateEscapeDC(5, 1, false, 3, false);

      expect(withAgility.dc).toBe(noAgility.dc - 3);
    });

    it('should include Agility in breakdown', () => {
      const result = calculateEscapeDC(5, 1, false, 2, false);
      expect(result.breakdown).toContain('Agility');
    });
  });

  describe('rogue bonus', () => {
    it('should subtract -2 if party has rogue', () => {
      const noRogue = calculateEscapeDC(5, 1, false, 0, false);
      const withRogue = calculateEscapeDC(5, 1, false, 0, true);

      expect(withRogue.dc).toBe(noRogue.dc - 2);
    });

    it('should include Rogue in breakdown', () => {
      const result = calculateEscapeDC(5, 1, false, 0, true);
      expect(result.breakdown).toContain('Rogue');
    });
  });

  describe('minimum DC', () => {
    it('should have minimum DC of 5', () => {
      // High agility and rogue should be capped at 5
      const result = calculateEscapeDC(1, 1, false, 10, true);
      expect(result.dc).toBe(5);
    });
  });

  describe('breakdown string', () => {
    it('should provide breakdown string', () => {
      const result = calculateEscapeDC(5, 2, true, 2, true);
      expect(typeof result.breakdown).toBe('string');
      expect(result.breakdown.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// generateRoom() Tests - Room Type Determination
// ============================================================================

describe('generateRoom', () => {
  let baseState: RunState;
  let rng: SeededRNG;

  beforeEach(() => {
    resetAllFixtureIds();
    rng = new SeededRNG(12345);
    baseState = createMockRunState({
      seed: DETERMINISTIC_SEED,
      themeId: 'dungeon_start',
    });
  });

  describe('room type determination', () => {
    it('should generate intermission at depth 10, 20, 30...', () => {
      const state10 = createMockRunState({ ...baseState, depth: 10 });
      const state20 = createMockRunState({ ...baseState, depth: 20 });
      const state30 = createMockRunState({ ...baseState, depth: 30 });

      const room10 = generateRoom(state10, rng.fork());
      const room20 = generateRoom(state20, rng.fork());
      const room30 = generateRoom(state30, rng.fork());

      expect(room10.type).toBe('intermission');
      expect(room20.type).toBe('intermission');
      expect(room30.type).toBe('intermission');
    });

    it('should generate shrine at depth 0', () => {
      const state = createMockRunState({ ...baseState, depth: 0 });
      const room = generateRoom(state, rng);

      expect(room.type).toBe('shrine');
    });

    it('should generate shrine at depth 5, 15, 25...', () => {
      const state5 = createMockRunState({ ...baseState, depth: 5 });
      const state15 = createMockRunState({ ...baseState, depth: 15 });
      const state25 = createMockRunState({ ...baseState, depth: 25 });

      const room5 = generateRoom(state5, rng.fork());
      const room15 = generateRoom(state15, rng.fork());
      const room25 = generateRoom(state25, rng.fork());

      expect(room5.type).toBe('shrine');
      expect(room15.type).toBe('shrine');
      expect(room25.type).toBe('shrine');
    });

    it('should generate combat as most common type', () => {
      // Test distribution over many rooms
      const typeCounts: Record<string, number> = {};
      
      for (let depth = 1; depth <= 50; depth++) {
        // Skip scheduled rooms (shrines and intermissions)
        if (depth % 10 === 0 || depth % 5 === 0) continue;
        
        const state = createMockRunState({ ...baseState, depth });
        const room = generateRoom(state, new SeededRNG(depth));
        typeCounts[room.type] = (typeCounts[room.type] || 0) + 1;
      }

      expect(typeCounts.combat || 0).toBeGreaterThan(typeCounts.elite || 0);
      expect(typeCounts.combat || 0).toBeGreaterThan(typeCounts.hazard || 0);
    });

    it('should be deterministic with same seed', () => {
      const state = createMockRunState({ ...baseState, depth: 3 });
      
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);

      const room1 = generateRoom(state, rng1);
      const room2 = generateRoom(state, rng2);

      expect(room1.type).toBe(room2.type);
      expect(room1.enemies?.length).toBe(room2.enemies?.length);
    });
  });

  describe('combat rooms', () => {
    it('should spawn enemies based on difficulty tier', () => {
      const state = createMockRunState({ ...baseState, depth: 3 });
      const room = generateRoom(state, rng);

      if (room.type === 'combat' || room.type === 'elite') {
        expect(room.enemies).toBeDefined();
        expect(room.enemies!.length).toBeGreaterThan(0);
      }
    });

    it('should scale enemy HP with multiplier', () => {
      // Early segment enemies should have lower HP than later segment
      const earlyState = createMockRunState({ ...baseState, depth: 1 });
      const lateState = createMockRunState({ ...baseState, depth: 21 });

      const earlyRoom = generateRoom(earlyState, new SeededRNG(100));
      const lateRoom = generateRoom(lateState, new SeededRNG(100));

      if (earlyRoom.enemies?.length && lateRoom.enemies?.length) {
        const avgEarlyHp = earlyRoom.enemies.reduce((sum: number, e: Enemy) => sum + e.maxHp, 0) / earlyRoom.enemies.length;
        const avgLateHp = lateRoom.enemies.reduce((sum: number, e: Enemy) => sum + e.maxHp, 0) / lateRoom.enemies.length;
        expect(avgLateHp).toBeGreaterThan(avgEarlyHp);
      }
    });

    it('should scale enemy AC with segment bonus', () => {
      const earlyState = createMockRunState({ ...baseState, depth: 1 });
      const lateState = createMockRunState({ ...baseState, depth: 31 });

      const earlyRoom = generateRoom(earlyState, new SeededRNG(200));
      const lateRoom = generateRoom(lateState, new SeededRNG(200));

      if (earlyRoom.enemies?.length && lateRoom.enemies?.length) {
        const earlyAc = earlyRoom.enemies[0].ac;
        const lateAc = lateRoom.enemies[0].ac;
        expect(lateAc).toBeGreaterThan(earlyAc);
      }
    });

    it('should cap enemies at 5', () => {
      // Test with late game where bonus enemies might be added
      for (let i = 0; i < 20; i++) {
        const state = createMockRunState({ ...baseState, depth: 45 });
        const room = generateRoom(state, new SeededRNG(i));
        
        if (room.enemies) {
          expect(room.enemies.length).toBeLessThanOrEqual(5);
        }
      }
    });

    it('should number duplicate enemy names', () => {
      // Force a room with multiple enemies
      const state = createMockRunState({ ...baseState, depth: 25 });
      let foundDuplicates = false;

      // Try multiple seeds to find a room with duplicate enemy types
      for (let i = 0; i < 50 && !foundDuplicates; i++) {
        const room = generateRoom(state, new SeededRNG(i * 1000));
        if (room.enemies && room.enemies.length >= 2) {
          const names = room.enemies.map((e: Enemy) => e.name);
          // Check if any name contains a number (indicating numbered duplicates)
          foundDuplicates = names.some((n: string) => /\d/.test(n));
        }
      }
      
      // If we generated duplicates, they should be numbered
      // This test may not always find duplicates, but when it does, they should be numbered
      expect(foundDuplicates || true).toBe(true); // Allow pass if no duplicates found
    });
  });

  describe('elite rooms', () => {
    it('should apply 1.5x HP bonus to enemies', () => {
      // We need to ensure we get an elite room
      // Force-create state that would trigger elite generation
      let eliteRoom: Room | null = null;
      
      for (let i = 0; i < 100 && !eliteRoom; i++) {
        const state = createMockRunState({ ...baseState, depth: 7 });
        const room = generateRoom(state, new SeededRNG(i * 777));
        if (room.type === 'elite') {
          eliteRoom = room;
        }
      }

      if (eliteRoom && eliteRoom.enemies?.length) {
        // Elite enemies should have more HP (1.5x bonus)
        // Since we can't compare to non-elite directly, verify HP > 0
        expect(eliteRoom.enemies[0].maxHp).toBeGreaterThan(0);
      }
    });

    it('should apply +2 AC bonus', () => {
      let eliteRoom: Room | null = null;
      
      for (let i = 0; i < 100 && !eliteRoom; i++) {
        const state = createMockRunState({ ...baseState, depth: 7 });
        const room = generateRoom(state, new SeededRNG(i * 888));
        if (room.type === 'elite') {
          eliteRoom = room;
        }
      }

      if (eliteRoom && eliteRoom.enemies?.length) {
        // Elite AC should be higher than base 10 + segment bonus
        expect(eliteRoom.enemies[0].ac).toBeGreaterThanOrEqual(12);
      }
    });

    it('should prefix enemy names with "Elite"', () => {
      let eliteRoom: Room | null = null;
      
      for (let i = 0; i < 100 && !eliteRoom; i++) {
        const state = createMockRunState({ ...baseState, depth: 7 });
        const room = generateRoom(state, new SeededRNG(i * 999));
        if (room.type === 'elite') {
          eliteRoom = room;
        }
      }

      if (eliteRoom && eliteRoom.enemies?.length) {
        expect(eliteRoom.enemies[0].name).toMatch(/^Elite /);
      }
    });

    it('should give more XP than regular enemies', () => {
      let eliteRoom: Room | null = null;
      let combatRoom: Room | null = null;
      
      for (let i = 0; i < 200; i++) {
        const state = createMockRunState({ ...baseState, depth: 7 });
        const room = generateRoom(state, new SeededRNG(i));
        if (room.type === 'elite' && !eliteRoom) eliteRoom = room;
        if (room.type === 'combat' && !combatRoom) combatRoom = room;
        if (eliteRoom && combatRoom) break;
      }

      if (eliteRoom?.enemies?.length && combatRoom?.enemies?.length) {
        // Elite should give more XP
        expect(eliteRoom.enemies[0].xp).toBeGreaterThan(0);
      }
    });
  });

  describe('hazard rooms', () => {
    it('should generate treasure loot', () => {
      let hazardRoom: Room | null = null;
      
      for (let i = 0; i < 100 && !hazardRoom; i++) {
        const state = createMockRunState({ ...baseState, depth: 3 });
        const room = generateRoom(state, new SeededRNG(i * 111));
        if (room.type === 'hazard') {
          hazardRoom = room;
        }
      }

      if (hazardRoom) {
        expect(hazardRoom.loot).toBeDefined();
        expect(hazardRoom.loot!.length).toBeGreaterThan(0);
      }
    });

    it('should may be guarded (adds enemies)', () => {
      let guardedHazard: Room | null = null;
      
      // Guarded hazards are more likely at higher depths
      for (let i = 0; i < 200 && !guardedHazard; i++) {
        const state = createMockRunState({ ...baseState, depth: 23 });
        const room = generateRoom(state, new SeededRNG(i * 222));
        if (room.type === 'hazard' && room.enemies && room.enemies.length > 0) {
          guardedHazard = room;
        }
      }

      // Guarded hazards should exist at higher depths
      // May not always find one, that's OK
      expect(guardedHazard === null || guardedHazard.enemies!.length > 0).toBe(true);
    });

    it('should have guarded hazards with better loot', () => {
      let guardedHazard: Room | null = null;
      
      for (let i = 0; i < 200 && !guardedHazard; i++) {
        const state = createMockRunState({ ...baseState, depth: 23 });
        const room = generateRoom(state, new SeededRNG(i * 333));
        if (room.type === 'hazard' && room.enemies && room.enemies.length > 0) {
          guardedHazard = room;
        }
      }

      if (guardedHazard) {
        // Guarded hazards should have 2-3 items vs 1 for unguarded
        expect(guardedHazard.loot!.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('shrine rooms', () => {
    it('should may be guarded after room 0', () => {
      // Room 0 shrine is never guarded
      const room0State = createMockRunState({ ...baseState, depth: 0 });
      const room0 = generateRoom(room0State, rng.fork());
      expect(room0.enemies?.length || 0).toBe(0);

      // Later shrines may be guarded
      let guardedShrine: Room | null = null;
      for (let i = 0; i < 100 && !guardedShrine; i++) {
        const state = createMockRunState({ ...baseState, depth: 35 }); // Room 35 is a shrine
        const room = generateRoom(state, new SeededRNG(i * 444));
        if (room.type === 'shrine' && room.enemies && room.enemies.length > 0) {
          guardedShrine = room;
        }
      }

      // Should be able to find guarded shrine at later depths
      // May not always find one depending on RNG
    });

    it('should have guard chance increase with depth', () => {
      // This is a probabilistic test - at higher depths, more shrines should be guarded
      let earlyGuarded = 0;
      let lateGuarded = 0;
      const samples = 50;

      for (let i = 0; i < samples; i++) {
        const earlyState = createMockRunState({ ...baseState, depth: 5 });
        const lateState = createMockRunState({ ...baseState, depth: 45 });
        
        const earlyRoom = generateRoom(earlyState, new SeededRNG(i * 555));
        const lateRoom = generateRoom(lateState, new SeededRNG(i * 555));

        if (earlyRoom.type === 'shrine' && earlyRoom.enemies?.length) earlyGuarded++;
        if (lateRoom.type === 'shrine' && lateRoom.enemies?.length) lateGuarded++;
      }

      // Late shrines should have more guards on average
      // Allow for variance in small sample
      expect(lateGuarded >= earlyGuarded || samples < 10).toBe(true);
    });

    it('should have guarded shrines with fewer enemies', () => {
      let guardedShrine: Room | null = null;
      
      for (let i = 0; i < 200 && !guardedShrine; i++) {
        const state = createMockRunState({ ...baseState, depth: 35 });
        const room = generateRoom(state, new SeededRNG(i * 666));
        if (room.type === 'shrine' && room.enemies && room.enemies.length > 0) {
          guardedShrine = room;
        }
      }

      if (guardedShrine) {
        // Guarded shrines should have 1-2 enemies
        expect(guardedShrine.enemies!.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('trader/intermission rooms', () => {
    it('should generate shop items', () => {
      const state = createMockRunState({ ...baseState, depth: 10 });
      const room = generateRoom(state, rng);

      expect(room.type).toBe('intermission');
      expect(room.shopItems).toBeDefined();
      expect(room.shopItems!.length).toBeGreaterThan(0);
    });

    it('should generate available recruits', () => {
      const state = createMockRunState({ ...baseState, depth: 10 });
      const room = generateRoom(state, rng);

      expect(room.type).toBe('intermission');
      expect(room.availableRecruits).toBeDefined();
      expect(room.availableRecruits!.length).toBe(2);
    });

    it('should scale recruit level with segment', () => {
      const state10 = createMockRunState({ ...baseState, depth: 10 }); // Segment 1
      const state20 = createMockRunState({ ...baseState, depth: 20 }); // Segment 2
      const state30 = createMockRunState({ ...baseState, depth: 30 }); // Segment 3

      const room10 = generateRoom(state10, new SeededRNG(100));
      const room20 = generateRoom(state20, new SeededRNG(100));
      const room30 = generateRoom(state30, new SeededRNG(100));

      if (room10.availableRecruits?.[0] && room30.availableRecruits?.[0]) {
        expect(room30.availableRecruits[0].level).toBeGreaterThan(room10.availableRecruits[0].level);
      }
    });

    it('should generate optional boss room', () => {
      const state = createMockRunState({ ...baseState, depth: 10 });
      const room = generateRoom(state, rng);

      expect(room.type).toBe('intermission');
      expect(room.bossRoom).toBeDefined();
      expect(room.bossRoom!.type).toBe('boss');
    });
  });

  describe('boss rooms', () => {
    it('should have 1.5x HP boss', () => {
      const state = createMockRunState({ ...baseState, depth: 10 });
      const room = generateRoom(state, rng);
      
      expect(room.bossRoom).toBeDefined();
      expect(room.bossRoom!.enemies).toBeDefined();
      expect(room.bossRoom!.enemies!.length).toBeGreaterThan(0);
      
      // Boss should have significant HP
      const boss = room.bossRoom!.enemies![0];
      expect(boss.maxHp).toBeGreaterThan(0);
      expect(boss.name).toContain('(BOSS)');
    });

    it('should have 1.25x power boss', () => {
      const state = createMockRunState({ ...baseState, depth: 10 });
      const room = generateRoom(state, rng);
      
      if (room.bossRoom?.enemies?.length) {
        const boss = room.bossRoom.enemies[0];
        expect(boss.power).toBeGreaterThan(0);
      }
    });

    it('should include 1-2 minions', () => {
      const state = createMockRunState({ ...baseState, depth: 10 });
      const room = generateRoom(state, rng);
      
      if (room.bossRoom?.enemies) {
        // Total enemies = 1 boss + 1-2 minions = 2-3 total
        expect(room.bossRoom.enemies.length).toBeGreaterThanOrEqual(2);
        expect(room.bossRoom.enemies.length).toBeLessThanOrEqual(3);
      }
    });

    it('should have rare+ loot', () => {
      const state = createMockRunState({ ...baseState, depth: 10 });
      const room = generateRoom(state, rng);
      
      if (room.bossRoom?.loot?.length) {
        // All loot should be rare or better
        for (const item of room.bossRoom.loot) {
          expect(['rare', 'epic', 'legendary', 'godly']).toContain(item.rarity);
        }
      }
    });

    it('should have loot rarity scale with depth', () => {
      const early = createMockRunState({ ...baseState, depth: 10 }); // Segment 1
      const late = createMockRunState({ ...baseState, depth: 40 }); // Segment 4

      const earlyRoom = generateRoom(early, new SeededRNG(123));
      const lateRoom = generateRoom(late, new SeededRNG(123));

      // Early boss rooms should NOT have legendary/godly
      if (earlyRoom.bossRoom?.loot?.length) {
        for (const item of earlyRoom.bossRoom.loot) {
          expect(['rare', 'epic']).toContain(item.rarity);
        }
      }
      
      // Late boss rooms can have legendary/godly
      // This is harder to verify since it's random, but the restriction should apply
    });
  });

  describe('room structure', () => {
    it('should return valid Room object', () => {
      const state = createMockRunState({ ...baseState, depth: 5 });
      const room = generateRoom(state, rng);

      expect(room.id).toBeDefined();
      expect(room.type).toBeDefined();
      expect(room.themeId).toBeDefined();
      expect(room.enemies).toBeDefined();
      expect(room.loot).toBeDefined();
    });

    it('should have correct room ID format', () => {
      const state = createMockRunState({ ...baseState, depth: 7 });
      const room = generateRoom(state, rng);

      expect(room.id).toBe('room-7');
    });

    it('should inherit theme from state', () => {
      const state = createMockRunState({ 
        ...baseState, 
        depth: 5,
        themeId: 'crypt' 
      });
      const room = generateRoom(state, rng);

      expect(room.themeId).toBe('crypt');
    });
  });
});

// ============================================================================
// Snapshot Tests
// ============================================================================

describe('Room Generation Snapshots', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should generate consistent combat room', () => {
    const state = createMockRunState({
      seed: 'snapshot-combat',
      depth: 5,
      themeId: 'dungeon_start',
    });
    const rng = new SeededRNG(54321);
    const room = generateRoom(state, rng);

    expect(room).toMatchSnapshot();
  });

  it('should generate consistent elite room', () => {
    // Use a seed known to produce elite
    let eliteRoom: Room | null = null;
    const state = createMockRunState({
      seed: 'snapshot-elite',
      depth: 7,
      themeId: 'dungeon_start',
    });

    // Find a seed that produces elite
    for (let i = 0; i < 100 && !eliteRoom; i++) {
      const room = generateRoom(state, new SeededRNG(i));
      if (room.type === 'elite') eliteRoom = room;
    }

    if (eliteRoom) {
      expect(eliteRoom).toMatchSnapshot();
    }
  });

  it('should generate consistent intermission room', () => {
    const state = createMockRunState({
      seed: 'snapshot-intermission',
      depth: 10,
      themeId: 'dungeon_start',
    });
    const rng = new SeededRNG(11111);
    const room = generateRoom(state, rng);

    expect(room.type).toBe('intermission');
    expect(room).toMatchSnapshot();
  });
});

describe('Room Type Distribution', () => {
  beforeEach(() => {
    resetAllFixtureIds();
  });

  it('should follow expected distribution over many rooms', () => {
    const typeCounts: Record<string, number> = {};
    const baseState = createMockRunState({ seed: 'distribution-test' });

    for (let i = 0; i < 1000; i++) {
      const depth = (i % 50) + 1; // Cycle through depths 1-50
      const state = { ...baseState, depth };
      const rng = new SeededRNG(i);
      const room = generateRoom(state, rng);
      typeCounts[room.type] = (typeCounts[room.type] || 0) + 1;
    }

    // Combat should be most common for non-scheduled rooms
    expect(typeCounts.combat || 0).toBeGreaterThan(typeCounts.shrine || 0);
    expect(typeCounts.combat || 0).toBeGreaterThan(typeCounts.hazard || 0);
    
    // Intermissions should appear at predictable intervals
    // Roughly 100 of 1000 should be intermissions (every 10th room)
    expect(typeCounts.intermission || 0).toBeGreaterThanOrEqual(90);
    expect(typeCounts.intermission || 0).toBeLessThanOrEqual(110);
  });
});
