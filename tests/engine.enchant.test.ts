import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../src/core/rng';
import { enchantItem, applyMaxHpDelta, totalMaxHpBonus } from '../src/engine/enchant';
import { createActor } from '../src/engine/state';
import type { Item } from '../src/engine/types';

function makeItem(over: Partial<Item> = {}): Item {
    return {
        id: 'test-item',
        name: 'Iron Sword',
        type: 'weapon',
        rarity: 'common',
        cost: 50,
        baseStats: {},
        ...over,
    };
}

describe('enchantItem', () => {
    it('never drops an existing bonus when stacking', () => {
        // Regression: the merge only summed keys present on the NEW roll, so
        // upgrading a "+8 attack" ring into a damage roll deleted the +8.
        const ring = makeItem({
            id: 'ring', name: 'Ring of Power', type: 'ring',
            enchantment: {
                tier: 3, name: 'of Mastery', description: 'Rare Boon',
                effect: { attackBonus: 8, damageBonus: 2, acBonus: 1, maxHpBonus: 4 },
            },
        });

        // Try many seeds so both jewelry branches (attack vs damage) are hit.
        for (let seed = 0; seed < 200; seed++) {
            const result = enchantItem(ring, 'ring1', new SeededRNG(seed), { depth: 30 });
            if (!result.isUpgrade) continue;

            const before = ring.enchantment!.effect;
            const after = result.item.enchantment!.effect;
            for (const key of ['attackBonus', 'damageBonus', 'acBonus', 'maxHpBonus'] as const) {
                expect(
                    after[key] ?? 0,
                    `${key} shrank from ${before[key]} to ${after[key]} (seed ${seed})`
                ).toBeGreaterThanOrEqual(before[key] ?? 0);
            }
        }
    });

    it('an upgrade never lowers the tier', () => {
        const item = makeItem({
            enchantment: { tier: 4, name: 'of Doom', description: 'Epic Boon', effect: { damageBonus: 9 } },
        });
        for (let seed = 0; seed < 100; seed++) {
            const result = enchantItem(item, 'main_hand', new SeededRNG(seed), { depth: 30 });
            if (result.isUpgrade) expect(result.tier).toBeGreaterThan(4);
        }
    });

    it('does not truncate base names containing " of "', () => {
        // Regression: `.replace(/ of .*$/, '')` turned "Staff of the Magi" into
        // "Staff" permanently on the first enchant.
        let item = makeItem({ name: 'Staff of the Magi' });
        for (let i = 0; i < 5; i++) {
            item = enchantItem(item, 'main_hand', new SeededRNG(i * 31 + 7), { depth: 30 }).item;
            expect(item.name.startsWith('Staff of the Magi')).toBe(true);
        }
    });

    it('does not stack suffixes across repeated enchants', () => {
        let item = makeItem();
        for (let i = 0; i < 6; i++) {
            item = enchantItem(item, 'main_hand', new SeededRNG(i * 977 + 5), { depth: 30 }).item;
        }
        // "Iron Sword of X" -- exactly one suffix, never "of X of Y of Z".
        expect(item.name.startsWith('Iron Sword ')).toBe(true);
        const suffix = item.enchantment!.name;
        expect(item.name).toBe(`Iron Sword ${suffix}`);
    });

    it('reports the max-HP delta it introduces', () => {
        const chest = makeItem({ id: 'c', name: 'Plate', type: 'chest', baseStats: { acBonus: 3 } });
        let sawHpGrant = false;
        for (let seed = 0; seed < 120; seed++) {
            const result = enchantItem(chest, 'chest', new SeededRNG(seed), { depth: 30 });
            const granted = result.item.enchantment!.effect.maxHpBonus ?? 0;
            expect(result.maxHpDelta).toBe(granted - totalMaxHpBonus(chest));
            if (granted > 0) sawHpGrant = true;
        }
        expect(sawHpGrant).toBe(true);
    });

    it('is deterministic for a given seed', () => {
        const item = makeItem();
        const a = enchantItem(item, 'main_hand', new SeededRNG(4242), { depth: 5 });
        const b = enchantItem(item, 'main_hand', new SeededRNG(4242), { depth: 5 });
        expect(a.item).toEqual(b.item);
    });

    it('does not mutate the input item', () => {
        const item = makeItem();
        const snapshot = JSON.stringify(item);
        enchantItem(item, 'main_hand', new SeededRNG(1), { depth: 5 });
        expect(JSON.stringify(item)).toBe(snapshot);
    });

    it('caps below Legendary at shallow depth', () => {
        for (let seed = 0; seed < 300; seed++) {
            const result = enchantItem(makeItem(), 'main_hand', new SeededRNG(seed), { depth: 3 });
            expect(result.tier).toBeLessThanOrEqual(4);
        }
    });
});

describe('applyMaxHpDelta', () => {
    it('raises current and max together on a gain', () => {
        const actor = createActor('a', 'A', 'fighter');
        const after = applyMaxHpDelta(actor, 6);
        expect(after.hp.max).toBe(actor.hp.max + 6);
        expect(after.hp.current).toBe(actor.hp.current + 6);
    });

    it('never drops the actor below 1 HP when gear comes off', () => {
        const actor = createActor('a', 'A', 'wizard');
        const wounded = { ...actor, hp: { current: 2, max: actor.hp.max } };
        const after = applyMaxHpDelta(wounded, -50);
        expect(after.hp.current).toBeGreaterThanOrEqual(1);
        expect(after.hp.max).toBeGreaterThanOrEqual(1);
        expect(after.hp.current).toBeLessThanOrEqual(after.hp.max);
    });

    it('round-trips: equipping then unequipping restores max HP', () => {
        // Regression: enchanting worn gear skipped the HP grant but unequipping
        // still subtracted it, permanently draining max HP on every cycle.
        const actor = createActor('a', 'A', 'fighter');
        let current = actor;
        for (let i = 0; i < 10; i++) {
            current = applyMaxHpDelta(current, 8);
            current = applyMaxHpDelta(current, -8);
        }
        expect(current.hp.max).toBe(actor.hp.max);
    });
});
