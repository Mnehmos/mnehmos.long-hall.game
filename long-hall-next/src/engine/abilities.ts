/**
 * ⚔️ Abilities System - Skills, cooldowns, and class abilities
 * 
 * This module provides:
 * - Class-specific ability definitions (Fighter, Wizard, Cleric, Rogue, Ranger)
 * - Cooldown management (turn-based, rest-based, combat-based)
 * - Ability execution with RNG support
 * - Target validation and effect processing
 * 
 * @module abilities
 */

import type { AbilityDef, AbilityState, Role, Actor, Enemy } from './types';
import type { RNG } from '@lib/dice';
import { roll } from '@lib/dice';

// ─────────────────────────────────────────────────────────────
// 📊 Ability Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Result from executing an ability
 */
export interface AbilityResult {
  /** Whether the ability was successfully executed */
  success: boolean;
  /** Damage dealt (if attack/damage ability) */
  damage?: number;
  /** Healing done (if heal ability) */
  healing?: number;
  /** Effect applied (buff/debuff/special) */
  effect?: string;
  /** Human-readable message describing the result */
  message: string;
  /** Extra attacks granted (for Action Surge) */
  extraAttacks?: number;
  /** Status applied to target/self */
  statusApplied?: string;
  /** Whether this was a multi-target ability */
  isAoe?: boolean;
}

/**
 * Cooldown tracking per ability
 * Key: ability ID, Value: remaining cooldown turns
 */
export type AbilityCooldowns = Record<string, number>;

// ─────────────────────────────────────────────────────────────
// ⚔️ Fighter Abilities
// ─────────────────────────────────────────────────────────────

const FIGHTER_ABILITIES: AbilityDef[] = [
  {
    id: 'second_wind',
    name: 'Second Wind',
    role: 'fighter',
    description: 'Heal 1d10+level HP',
    cooldownType: 'rest',
    cooldownValue: 1,
    effect: {
      type: 'heal',
      target: 'self',
      dice: '1d10',
      modifier: 0 // Level added at runtime
    }
  },
  {
    id: 'action_surge',
    name: 'Action Surge',
    role: 'fighter',
    description: 'Take an extra attack this turn',
    cooldownType: 'rest',
    cooldownValue: 1,
    effect: {
      type: 'special',
      target: 'self'
    }
  },
  {
    id: 'champion_strike',
    name: 'Champion Strike',
    role: 'fighter',
    description: 'Powerful strike for Weapon + 2d6 damage',
    cooldownType: 'turns',
    cooldownValue: 3,
    effect: {
      type: 'attack',
      target: 'enemy',
      dice: '2d6',
      useWeaponDamage: true,
      attackBonus: 2
    }
  }
];

// ─────────────────────────────────────────────────────────────
// 🔮 Wizard Abilities
// ─────────────────────────────────────────────────────────────

const WIZARD_ABILITIES: AbilityDef[] = [
  {
    id: 'magic_missile',
    name: 'Magic Missile',
    role: 'wizard',
    description: 'Auto-hit 3d4+3 force damage',
    cooldownType: 'turns',
    cooldownValue: 2,
    effect: {
      type: 'damage',
      target: 'enemy',
      dice: '3d4',
      modifier: 3
    }
  },
  {
    id: 'fireball',
    name: 'Fireball',
    role: 'wizard',
    description: '6d6 fire damage to all enemies',
    cooldownType: 'rest',
    cooldownValue: 1,
    effect: {
      type: 'damage',
      target: 'all_enemies',
      dice: '6d6'
    }
  },
  {
    id: 'shield',
    name: 'Shield',
    role: 'wizard',
    description: '+5 AC until next turn',
    cooldownType: 'combat',
    cooldownValue: 1,
    effect: {
      type: 'buff',
      target: 'self',
      modifier: 5
    }
  }
];

// ─────────────────────────────────────────────────────────────
// ✝️ Cleric Abilities
// ─────────────────────────────────────────────────────────────

const CLERIC_ABILITIES: AbilityDef[] = [
  {
    id: 'healing_word',
    name: 'Healing Word',
    role: 'cleric',
    description: 'Heal ally 1d8+level',
    cooldownType: 'turns',
    cooldownValue: 2,
    effect: {
      type: 'heal',
      target: 'ally',
      dice: '1d8',
      modifier: 0 // Level added at runtime
    }
  },
  {
    id: 'sacred_flame',
    name: 'Sacred Flame',
    role: 'cleric',
    description: '1d8 radiant damage',
    cooldownType: 'turns',
    cooldownValue: 0, // Cantrip, always available
    effect: {
      type: 'damage',
      target: 'enemy',
      dice: '1d8'
    }
  },
  {
    id: 'turn_undead',
    name: 'Turn Undead',
    role: 'cleric',
    description: 'Fear undead enemies for 2 turns',
    cooldownType: 'rest',
    cooldownValue: 1,
    effect: {
      type: 'debuff',
      target: 'all_enemies'
    }
  }
];

// ─────────────────────────────────────────────────────────────
// 🗡️ Rogue Abilities
// ─────────────────────────────────────────────────────────────

const ROGUE_ABILITIES: AbilityDef[] = [
  {
    id: 'sneak_attack',
    name: 'Sneak Attack',
    role: 'rogue',
    description: '+2d6 damage (Requires Hidden)',
    cooldownType: 'combat',
    cooldownValue: 1,
    effect: {
      type: 'damage',
      target: 'enemy',
      dice: '2d6'
    }
  },
  {
    id: 'cunning_action',
    name: 'Cunning Action',
    role: 'rogue',
    description: 'Hide - Become untargetable',
    cooldownType: 'turns',
    cooldownValue: 0, // Always available
    effect: {
      type: 'special',
      target: 'self',
      status: 'hidden'
    }
  },
  {
    id: 'evasion',
    name: 'Evasion',
    role: 'rogue',
    description: 'Dodge one attack completely',
    cooldownType: 'rest',
    cooldownValue: 1,
    effect: {
      type: 'special',
      target: 'self'
    }
  }
];

// ─────────────────────────────────────────────────────────────
// 🏹 Ranger Abilities
// ─────────────────────────────────────────────────────────────

const RANGER_ABILITIES: AbilityDef[] = [
  {
    id: 'aimed_shot',
    name: 'Aimed Shot',
    role: 'ranger',
    description: 'High accuracy ranged attack (+5 to hit, +2 damage)',
    cooldownType: 'turns',
    cooldownValue: 2,
    effect: {
      type: 'attack',
      target: 'enemy',
      damageBonus: 2,
      attackBonus: 5
    }
  },
  {
    id: 'volley',
    name: 'Volley',
    role: 'ranger',
    description: 'Attack all enemies with ranged damage (1d6 each)',
    cooldownType: 'rest',
    cooldownValue: 1,
    effect: {
      type: 'special', // Handled as AOE attack
      target: 'all_enemies',
      dice: '1d6'
    }
  },
  {
    id: 'camouflage',
    name: 'Camouflage',
    role: 'ranger',
    description: 'Become Hidden (Stealth)',
    cooldownType: 'combat',
    cooldownValue: 1,
    effect: {
      type: 'buff',
      target: 'self',
      status: 'hidden'
    }
  }
];

// ─────────────────────────────────────────────────────────────
// 📚 Ability Registry
// ─────────────────────────────────────────────────────────────

/**
 * All abilities combined from all classes
 */
export const ALL_ABILITIES: AbilityDef[] = [
  ...FIGHTER_ABILITIES,
  ...WIZARD_ABILITIES,
  ...CLERIC_ABILITIES,
  ...ROGUE_ABILITIES,
  ...RANGER_ABILITIES
];

/**
 * Get abilities available to a specific class
 * 
 * @param role - The class/role to get abilities for
 * @returns Array of ability definitions for that class
 * 
 * @example
 * const wizardAbilities = getClassAbilities('wizard');
 * // Returns: [magic_missile, fireball, shield]
 */
export function getClassAbilities(role: Role): AbilityDef[] {
  switch (role) {
    case 'fighter': return FIGHTER_ABILITIES;
    case 'wizard': return WIZARD_ABILITIES;
    case 'cleric': return CLERIC_ABILITIES;
    case 'rogue': return ROGUE_ABILITIES;
    case 'ranger': return RANGER_ABILITIES;
    default: return [];
  }
}

/**
 * Get a specific ability by its ID
 * 
 * @param abilityId - The unique ability identifier
 * @returns The ability definition, or undefined if not found
 * 
 * @example
 * const fireball = getAbility('fireball');
 * // Returns: { id: 'fireball', name: 'Fireball', ... }
 */
export function getAbility(abilityId: string): AbilityDef | undefined {
  return ALL_ABILITIES.find(a => a.id === abilityId);
}

/**
 * Get abilities for a role with their current cooldown states
 * 
 * @param role - The class/role
 * @param abilityStates - Current ability states from the actor
 * @returns Array of abilities with their current cooldown info
 */
export function getAbilitiesWithCooldowns(
  role: Role,
  abilityStates: AbilityState[]
): Array<AbilityDef & { currentCooldown: number; isReady: boolean }> {
  const abilities = getClassAbilities(role);
  return abilities.map(ability => {
    const state = abilityStates.find(s => s.abilityId === ability.id);
    const currentCooldown = state?.currentCooldown ?? 0;
    return {
      ...ability,
      currentCooldown,
      isReady: currentCooldown === 0
    };
  });
}

// ─────────────────────────────────────────────────────────────
// ⚡ Ability Execution
// ─────────────────────────────────────────────────────────────

/**
 * Check if an ability can be used by the actor
 * 
 * Validates:
 * - Ability is not on cooldown
 * - Actor has required statuses (e.g., 'hidden' for sneak attack)
 * - Actor is alive
 * - Target is valid for the ability type
 * 
 * @param user - The actor using the ability
 * @param ability - The ability definition
 * @param target - Optional target (required for enemy/ally abilities)
 * @returns Whether the ability can be used
 */
export function canUseAbility(
  user: Actor,
  ability: AbilityDef,
  target?: Actor | Enemy
): boolean {
  // Actor must be alive
  if (!user.isAlive) {
    return false;
  }

  // Check cooldown
  const abilityState = user.abilities.find(a => a.abilityId === ability.id);
  if (abilityState && abilityState.currentCooldown > 0) {
    return false;
  }

  // Check ability-specific requirements
  switch (ability.id) {
    case 'sneak_attack':
      // Sneak attack requires hidden status
      if (!user.statuses.includes('hidden')) {
        return false;
      }
      break;
  }

  // Validate target for targeted abilities
  const targetType = ability.effect.target;
  if (targetType === 'enemy' && !target) {
    return false;
  }
  if (targetType === 'ally' && !target) {
    return false;
  }

  return true;
}

/**
 * Check why an ability cannot be used (for UI feedback)
 * 
 * @param user - The actor using the ability
 * @param ability - The ability definition
 * @returns Reason string, or null if ability can be used
 */
export function getAbilityBlockedReason(
  user: Actor,
  ability: AbilityDef
): string | null {
  if (!user.isAlive) {
    return 'Actor is dead';
  }

  const abilityState = user.abilities.find(a => a.abilityId === ability.id);
  if (abilityState && abilityState.currentCooldown > 0) {
    return `On cooldown (${abilityState.currentCooldown} turns remaining)`;
  }

  if (ability.id === 'sneak_attack' && !user.statuses.includes('hidden')) {
    return 'Requires hidden status';
  }

  return null;
}

/**
 * Execute an ability and calculate its effects
 * 
 * @param user - The actor using the ability
 * @param ability - The ability to execute
 * @param target - Target(s) for the ability
 * @param rng - Random number generator for deterministic rolls
 * @returns The result of the ability execution
 * 
 * @example
 * const result = executeAbility(wizard, fireball, enemies, rng);
 * // Returns: { success: true, damage: 24, message: "Wizard casts Fireball for 24 fire damage!", isAoe: true }
 */
export function executeAbility(
  user: Actor,
  ability: AbilityDef,
  target: Actor | Enemy | Actor[] | Enemy[],
  rng: RNG
): AbilityResult {
  const effectType = ability.effect.type;

  switch (effectType) {
    case 'damage':
      return executeDamageAbility(user, ability, target, rng);
    
    case 'heal':
      return executeHealAbility(user, ability, target, rng);
    
    case 'buff':
      return executeBuffAbility(user, ability);
    
    case 'debuff':
      return executeDebuffAbility(user, ability, target);
    
    case 'attack':
      return executeAttackAbility(user, ability, target, rng);
    
    case 'special':
      return executeSpecialAbility(user, ability, target, rng);
    
    default:
      return {
        success: false,
        message: `Unknown ability type: ${effectType}`
      };
  }
}

/**
 * Execute a damage ability (magic damage, no attack roll)
 */
function executeDamageAbility(
  user: Actor,
  ability: AbilityDef,
  target: Actor | Enemy | Actor[] | Enemy[],
  rng: RNG
): AbilityResult {
  const dice = ability.effect.dice;
  const modifier = ability.effect.modifier ?? 0;

  if (!dice) {
    return { success: false, message: 'Damage ability missing dice expression' };
  }

  const expression = modifier > 0 ? `${dice}+${modifier}` : modifier < 0 ? `${dice}${modifier}` : dice;
  const rollResult = roll(expression, rng);
  const damage = rollResult.total;

  const isAoe = ability.effect.target === 'all_enemies';

  return {
    success: true,
    damage,
    message: `${user.name} casts ${ability.name} for ${damage} damage!`,
    isAoe
  };
}

/**
 * Execute a healing ability
 */
function executeHealAbility(
  user: Actor,
  ability: AbilityDef,
  target: Actor | Enemy | Actor[] | Enemy[],
  rng: RNG
): AbilityResult {
  const dice = ability.effect.dice;
  // For abilities like Second Wind and Healing Word, add user's level
  const levelBonus = ability.effect.modifier === 0 ? user.level : (ability.effect.modifier ?? 0);

  if (!dice) {
    return { success: false, message: 'Heal ability missing dice expression' };
  }

  const expression = levelBonus > 0 ? `${dice}+${levelBonus}` : dice;
  const rollResult = roll(expression, rng);
  const healing = rollResult.total;

  const targetName = ability.effect.target === 'self' 
    ? user.name 
    : (Array.isArray(target) ? 'party' : (target as Actor).name);

  return {
    success: true,
    healing,
    message: `${user.name} uses ${ability.name} to heal ${targetName} for ${healing} HP!`
  };
}

/**
 * Execute a buff ability
 */
function executeBuffAbility(
  user: Actor,
  ability: AbilityDef
): AbilityResult {
  const status = ability.effect.status;
  const modifier = ability.effect.modifier;

  let message = `${user.name} uses ${ability.name}!`;
  let effect: string | undefined;

  if (status) {
    effect = status;
    message = `${user.name} uses ${ability.name} and gains ${status}!`;
  } else if (modifier) {
    effect = `+${modifier} AC`;
    message = `${user.name} uses ${ability.name} for +${modifier} AC until next turn!`;
  }

  return {
    success: true,
    effect,
    message,
    statusApplied: status
  };
}

/**
 * Execute a debuff ability
 */
function executeDebuffAbility(
  user: Actor,
  ability: AbilityDef,
  target: Actor | Enemy | Actor[] | Enemy[]
): AbilityResult {
  const isAoe = ability.effect.target === 'all_enemies';

  return {
    success: true,
    effect: 'debuff',
    message: `${user.name} uses ${ability.name}!`,
    isAoe
  };
}

/**
 * Execute a weapon-based attack ability (e.g., Champion Strike, Aimed Shot)
 */
function executeAttackAbility(
  user: Actor,
  ability: AbilityDef,
  target: Actor | Enemy | Actor[] | Enemy[],
  rng: RNG
): AbilityResult {
  const attackBonus = ability.effect.attackBonus ?? 0;
  const damageBonus = ability.effect.damageBonus ?? 0;
  const bonusDice = ability.effect.dice;
  const useWeaponDamage = ability.effect.useWeaponDamage ?? false;

  let totalDamage = damageBonus;

  // Roll bonus dice if present
  if (bonusDice) {
    const rollResult = roll(bonusDice, rng);
    totalDamage += rollResult.total;
  }

  // Note: Weapon damage would be added by the combat system

  const targetName = Array.isArray(target) 
    ? 'all enemies' 
    : (target as Enemy).name ?? (target as Actor).name;

  return {
    success: true,
    damage: totalDamage,
    message: `${user.name} uses ${ability.name} on ${targetName} for ${totalDamage} bonus damage!`,
    effect: useWeaponDamage ? 'add_weapon_damage' : undefined
  };
}

/**
 * Execute a special ability (Action Surge, Cunning Action, etc.)
 */
function executeSpecialAbility(
  user: Actor,
  ability: AbilityDef,
  target: Actor | Enemy | Actor[] | Enemy[],
  rng: RNG
): AbilityResult {
  switch (ability.id) {
    case 'action_surge':
      return {
        success: true,
        message: `${user.name} uses Action Surge! Extra attack granted!`,
        extraAttacks: 1
      };

    case 'cunning_action':
      return {
        success: true,
        message: `${user.name} uses Cunning Action to hide!`,
        statusApplied: 'hidden',
        effect: 'hidden'
      };

    case 'evasion':
      return {
        success: true,
        message: `${user.name} uses Evasion! Will dodge the next attack!`,
        effect: 'evasion'
      };

    case 'volley':
      // Ranger AOE attack
      const dice = ability.effect.dice ?? '1d6';
      const rollResult = roll(dice, rng);
      return {
        success: true,
        damage: rollResult.total,
        message: `${user.name} fires a Volley! ${rollResult.total} damage to all enemies!`,
        isAoe: true
      };

    default:
      return {
        success: true,
        message: `${user.name} uses ${ability.name}!`
      };
  }
}

// ─────────────────────────────────────────────────────────────
// ⏱️ Cooldown Management
// ─────────────────────────────────────────────────────────────

/**
 * Tick all cooldowns down by 1 turn
 * 
 * @param cooldowns - Current cooldown state
 * @returns New cooldown state with decremented values
 * 
 * @example
 * const cooldowns = { fireball: 3, shield: 1 };
 * const newCooldowns = tickCooldowns(cooldowns);
 * // Returns: { fireball: 2, shield: 0 }
 */
export function tickCooldowns(cooldowns: AbilityCooldowns): AbilityCooldowns {
  const result: AbilityCooldowns = {};
  for (const [abilityId, remaining] of Object.entries(cooldowns)) {
    result[abilityId] = Math.max(0, remaining - 1);
  }
  return result;
}

/**
 * Tick all ability states on an actor's abilities
 * 
 * @param abilities - Array of ability states
 * @returns New array with decremented cooldowns
 */
export function tickAbilityStates(abilities: AbilityState[]): AbilityState[] {
  return abilities.map(state => ({
    ...state,
    currentCooldown: Math.max(0, state.currentCooldown - 1)
  }));
}

/**
 * Start ability cooldown after use
 * 
 * @param abilityId - The ability that was used
 * @param cooldowns - Current cooldown state
 * @returns New cooldown state with the ability on cooldown
 */
export function startCooldown(
  abilityId: string,
  cooldowns: AbilityCooldowns
): AbilityCooldowns {
  const ability = getAbility(abilityId);
  if (!ability) {
    return cooldowns;
  }

  return {
    ...cooldowns,
    [abilityId]: ability.cooldownValue
  };
}

/**
 * Start ability cooldown in ability states
 * 
 * @param abilityId - The ability that was used
 * @param abilities - Current ability states
 * @returns New ability states with the cooldown started
 */
export function startAbilityCooldown(
  abilityId: string,
  abilities: AbilityState[]
): AbilityState[] {
  const ability = getAbility(abilityId);
  if (!ability) {
    return abilities;
  }

  const existingIndex = abilities.findIndex(a => a.abilityId === abilityId);
  const newState: AbilityState = {
    abilityId,
    currentCooldown: ability.cooldownValue
  };

  if (existingIndex >= 0) {
    const result = [...abilities];
    result[existingIndex] = newState;
    return result;
  }

  return [...abilities, newState];
}

/**
 * Check if an ability is currently on cooldown
 * 
 * @param abilityId - The ability to check
 * @param cooldowns - Current cooldown state
 * @returns Whether the ability is on cooldown
 */
export function isOnCooldown(
  abilityId: string,
  cooldowns: AbilityCooldowns
): boolean {
  return (cooldowns[abilityId] ?? 0) > 0;
}

/**
 * Check if an ability is on cooldown in ability states
 * 
 * @param abilityId - The ability to check
 * @param abilities - Current ability states
 * @returns Whether the ability is on cooldown
 */
export function isAbilityOnCooldown(
  abilityId: string,
  abilities: AbilityState[]
): boolean {
  const state = abilities.find(a => a.abilityId === abilityId);
  return state ? state.currentCooldown > 0 : false;
}

/**
 * Get remaining cooldown turns for an ability
 * 
 * @param abilityId - The ability to check
 * @param cooldowns - Current cooldown state
 * @returns Number of turns remaining (0 if ready)
 */
export function getCooldownRemaining(
  abilityId: string,
  cooldowns: AbilityCooldowns
): number {
  return cooldowns[abilityId] ?? 0;
}

/**
 * Get remaining cooldown from ability states
 * 
 * @param abilityId - The ability to check
 * @param abilities - Current ability states
 * @returns Number of turns remaining (0 if ready)
 */
export function getAbilityCooldownRemaining(
  abilityId: string,
  abilities: AbilityState[]
): number {
  const state = abilities.find(a => a.abilityId === abilityId);
  return state?.currentCooldown ?? 0;
}

/**
 * Reset all cooldowns (on long rest or combat end for 'combat' type)
 * 
 * @param cooldowns - Current cooldown state
 * @param type - Type of reset ('rest' resets all, 'combat' resets combat-only)
 * @returns New cooldown state with appropriate abilities reset
 */
export function resetCooldowns(
  cooldowns: AbilityCooldowns,
  type: 'rest' | 'combat'
): AbilityCooldowns {
  if (type === 'rest') {
    // Rest resets everything
    return {};
  }

  // Combat reset only affects combat-type cooldowns
  const result: AbilityCooldowns = {};
  for (const [abilityId, remaining] of Object.entries(cooldowns)) {
    const ability = getAbility(abilityId);
    if (ability && ability.cooldownType !== 'combat') {
      result[abilityId] = remaining;
    }
    // Combat cooldowns are not copied (reset to 0)
  }
  return result;
}

/**
 * Reset ability states on rest or combat end
 * 
 * @param abilities - Current ability states
 * @param type - Type of reset
 * @returns New ability states with appropriate cooldowns reset
 */
export function resetAbilityCooldowns(
  abilities: AbilityState[],
  type: 'rest' | 'combat'
): AbilityState[] {
  if (type === 'rest') {
    // Rest resets all cooldowns to 0
    return abilities.map(state => ({
      ...state,
      currentCooldown: 0
    }));
  }

  // Combat reset only affects combat-type cooldowns
  return abilities.map(state => {
    const ability = getAbility(state.abilityId);
    if (ability && ability.cooldownType === 'combat') {
      return { ...state, currentCooldown: 0 };
    }
    return state;
  });
}

// ─────────────────────────────────────────────────────────────
// 🎮 Initialization
// ─────────────────────────────────────────────────────────────

/**
 * Initialize ability states for a new actor
 * 
 * @param role - The actor's class/role
 * @returns Initial ability states (all ready)
 */
export function initializeAbilityStates(role: Role): AbilityState[] {
  const abilities = getClassAbilities(role);
  return abilities.map(ability => ({
    abilityId: ability.id,
    currentCooldown: 0
  }));
}
