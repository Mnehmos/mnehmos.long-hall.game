import type { Actor, EnchantEffect, EquipmentSlot, Item } from './types';
import type { SeededRNG } from '../core/rng';
import { TIER_NAMES, tierFromRoll, type EnchantTier } from './constants';

const WEAPON_SUFFIXES: Record<EnchantTier, string[]> = {
    1: ['of Striking', 'of the Blade', 'of Sharpness'],
    2: ['of Might', 'of Slaying', 'of the Warrior'],
    3: ['of Fury', 'of Destruction', 'of the Champion'],
    4: ['of Annihilation', 'of the Titan', 'of Doom'],
    5: ['of Legends', 'of the Godslayer', 'of Ruin'],
    6: ['of the Apocalypse', 'of Oblivion', 'Worldender'],
};
const ARMOR_SUFFIXES: Record<EnchantTier, string[]> = {
    1: ['of Protection', 'of Warding', 'of the Guard'],
    2: ['of Defense', 'of the Sentinel', 'of Resilience'],
    3: ['of Fortitude', 'of the Bulwark', 'of Endurance'],
    4: ['of Invincibility', 'of the Immortal', 'of Iron Will'],
    5: ['of Eternity', 'of the Divine', 'Godshield'],
    6: ['of the Divine Aegis', 'of Immortality', 'Cosmic Bulwark'],
};
const JEWELRY_SUFFIXES: Record<EnchantTier, string[]> = {
    1: ['of Minor Power', 'of the Apprentice', 'of Focus'],
    2: ['of Enhancement', 'of the Adept', 'of Clarity'],
    3: ['of Mastery', 'of the Sage', 'of Potency'],
    4: ['of Supremacy', 'of the Archmage', 'of Domination'],
    5: ['of Omnipotence', 'of the Infinite', 'Godstone'],
    6: ['of the Gods', 'of Cosmic Power', 'Starbound'],
};
const UTILITY_SUFFIXES: Record<EnchantTier, string[]> = {
    1: ['of Fortune', 'of Luck', 'of the Traveler'],
    2: ['of Swiftness', 'of Haste', 'of the Runner'],
    3: ['of Prosperity', 'of Riches', 'of the Merchant'],
    4: ['of the Windwalker', 'of Agility', 'of the Scout'],
    5: ['of the Midas Touch', 'of Avarice', 'of Treasure'],
    6: ['of the Cosmic Wanderer', 'of Infinite Fortune', 'Starstrider'],
};

const JEWELRY_SLOTS: EquipmentSlot[] = ['ring1', 'ring2', 'neck'];
const ARMOR_SLOTS: EquipmentSlot[] = ['chest', 'legs', 'head', 'feet'];

/** Every stat key an enchantment can carry. */
const EFFECT_KEYS = [
    'attackBonus', 'damageBonus', 'acBonus', 'maxHpBonus',
    'escapeBonus', 'lootBonus', 'goldBonus',
] as const;

/**
 * Total max-HP granted by an item (base + enchantment).
 * Tolerates items missing `baseStats` -- older saves and hand-built fixtures
 * don't always carry it.
 */
export function totalMaxHpBonus(item: Item | undefined): number {
    if (!item) return 0;
    return (item.baseStats?.maxHpBonus || 0) + (item.enchantment?.effect?.maxHpBonus || 0);
}

/**
 * Apply a change in max-HP to an actor, keeping current HP consistent.
 *
 * Gains raise both max and current. Losses lower max and clamp current, but
 * never drop the actor to 0 -- unequipping gear shouldn't kill you.
 */
export function applyMaxHpDelta(actor: Actor, delta: number): Actor {
    if (delta === 0) return actor;
    const max = Math.max(1, actor.hp.max + delta);
    const current = delta > 0
        ? actor.hp.current + delta
        : Math.max(1, Math.min(actor.hp.current + delta, max));
    return { ...actor, hp: { current: Math.min(current, max), max } };
}

/**
 * Merge a freshly rolled enchantment onto an existing one.
 *
 * Every key is summed, including ones the new roll didn't produce. The old
 * code only merged keys present on the NEW effect, so upgrading a "+8 attack"
 * ring into a damage roll silently deleted the +8.
 */
function mergeEffects(oldEffect: EnchantEffect, newEffect: EnchantEffect): EnchantEffect {
    const merged: EnchantEffect = {};
    for (const key of EFFECT_KEYS) {
        const sum = (oldEffect[key] || 0) + (newEffect[key] || 0);
        if (sum !== 0) merged[key] = sum;
    }
    return merged;
}

/**
 * Strip a previously applied suffix so repeated enchanting doesn't stack
 * suffixes ("Iron Sword of Might of Fury of Doom").
 *
 * Only removes the exact suffix we recorded on the item. The old code ran
 * `.replace(/ of .*$/, '')` against the whole name, which permanently
 * truncated legitimate base names like "Staff of the Magi" -> "Staff".
 */
function baseNameOf(item: Item): string {
    const suffix = item.enchantment?.name;
    if (suffix && item.name.endsWith(` ${suffix}`)) {
        return item.name.slice(0, -(suffix.length + 1));
    }
    return item.name;
}

function suffixTableFor(item: Item, slot: EquipmentSlot, isUtility: boolean) {
    if (isUtility) return UTILITY_SUFFIXES;
    if (slot === 'main_hand' || slot === 'off_hand') {
        return item.type === 'shield' ? ARMOR_SUFFIXES : WEAPON_SUFFIXES;
    }
    if (ARMOR_SLOTS.includes(slot)) return ARMOR_SUFFIXES;
    return JEWELRY_SUFFIXES;
}

export interface EnchantResult {
    item: Item;
    tier: EnchantTier;
    tierName: string;
    bonusValue: number;
    isUpgrade: boolean;
    /** Change in the wearer's max HP caused by this enchantment. */
    maxHpDelta: number;
}

export interface EnchantOptions {
    /** Faith skill of the wearer; nudges the tier roll upward. */
    faith?: number;
    /** Boss shrines guarantee a strong roll. */
    guaranteedStrong?: boolean;
    /** Below this depth, cap the roll short of Legendary. */
    depth?: number;
    /** Force weapon-style bonuses regardless of slot (starting shrine). */
    forceWeapon?: boolean;
}

/**
 * Roll and apply an enchantment to `item` occupying `slot`.
 * Pure: returns a new Item, never mutates the input.
 */
export function enchantItem(
    item: Item,
    slot: EquipmentSlot,
    rng: SeededRNG,
    options: EnchantOptions = {}
): EnchantResult {
    const { faith = 0, guaranteedStrong = false, depth = 0, forceWeapon = false } = options;
    const faithBonus = faith * 5; // +5% per faith point toward better tiers

    const existingTier = item.enchantment?.tier || 0;
    const isUpgrade = existingTier > 0 && rng.chance(0.5);

    const tierRoll = guaranteedStrong
        ? 60 + rng.float() * 35 + faithBonus // Force Rare+, rarely Legendary
        : rng.float() * 100 + faithBonus;

    // Soft cap: no Legendary/Godly before depth 10. Clamp the resulting TIER,
    // not the roll -- the old code clamped the roll to 95, which still lands in
    // the Legendary band (93-99), so the cap it documented never applied.
    const rolledTier = tierFromRoll(tierRoll);
    const baseTier = (depth < 10 ? Math.min(rolledTier, 4) : rolledTier) as EnchantTier;
    const tier = (isUpgrade
        ? Math.min(6, Math.max(baseTier, existingTier + 1))
        : baseTier) as EnchantTier;
    const tierName = TIER_NAMES[tier - 1];

    const bonusValue = tier + rng.int(0, tier - 1); // tier .. tier*2-1

    const isJewelry = !forceWeapon && JEWELRY_SLOTS.includes(slot);
    const isUtility = isJewelry && rng.chance(0.15);

    const rolled: EnchantEffect = {};
    if (isUtility) {
        const utilRoll = rng.float();
        if (utilRoll < 0.33) rolled.escapeBonus = tier * 3;
        else if (utilRoll < 0.66) rolled.lootBonus = tier * 2;
        else rolled.goldBonus = tier * 5;
    } else if (forceWeapon || slot === 'main_hand' || slot === 'off_hand') {
        if (!forceWeapon && item.type === 'shield') {
            rolled.acBonus = bonusValue;
            if (tier >= 3) rolled.maxHpBonus = tier;
        } else {
            rolled.attackBonus = Math.floor(bonusValue / 2) || 1;
            rolled.damageBonus = bonusValue;
        }
    } else if (ARMOR_SLOTS.includes(slot)) {
        rolled.acBonus = bonusValue;
        if (tier >= 3) rolled.maxHpBonus = tier * 2;
    } else {
        // Jewelry: offensive
        if (rng.chance(0.5)) rolled.attackBonus = bonusValue;
        else rolled.damageBonus = bonusValue;
    }

    const previousEffect = item.enchantment?.effect ?? {};
    const effect = isUpgrade ? mergeEffects(previousEffect, rolled) : rolled;

    const suffixTable = suffixTableFor(item, slot, isUtility);
    const suffix = rng.pick(suffixTable[tier]);
    const base = baseNameOf(item);

    const history = [...(item.history || [])];
    history.push(isUpgrade
        ? `Stacked with ${tierName} enchantment (now Tier ${tier})`
        : `Blessed with ${tierName} enchantment`);
    while (history.length > 10) history.shift();

    const enchanted: Item = {
        ...item,
        name: `${base} ${suffix}`,
        enchantment: { tier, name: suffix, effect, description: `${tierName} Boon` },
        history,
    };

    return {
        item: enchanted,
        tier,
        tierName,
        bonusValue,
        isUpgrade,
        // Enchanting gear that's already worn has to adjust the wearer's max HP.
        // Previously this was skipped on enchant but still subtracted on
        // unequip, permanently draining max HP.
        maxHpDelta: totalMaxHpBonus(enchanted) - totalMaxHpBonus(item),
    };
}
