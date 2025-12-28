import { SeededRNG } from '../core/rng';
import type { RunState, Room, RoomType } from './types';
import { getRoomWeights, ENEMIES, ITEMS, RECRUITS } from '../content/tables';
import { getThemeDef } from './generateTheme';
import { hashWithSeed } from '../core/hash';

/**
 * Calculate difficulty scaling based on depth
 * Segment 1 (rooms 1-10): Power 1-2 enemies
 * Segment 2 (rooms 11-20): Power 2-4 enemies
 * Segment 3 (rooms 21-30): Power 3-6 enemies
 * Segment 4 (rooms 31-40): Power 5-8 enemies
 * Segment 5 (rooms 41-50): Power 7-10 enemies
 * Segment 6+ (rooms 51+): Power 9-13 enemies (boss tier included)
 *
 * Within each segment, difficulty ramps up slightly (rooms 1-9)
 */
export function getDifficulty(depth: number): {
    segment: number;
    roomInSegment: number;
    multiplier: number;
    minPower: number;
    maxPower: number;
    acBonus: number;
    enemyCountBonus: number;
} {
    const segment = Math.floor((depth - 1) / 10) + 1; // 1-10 = segment 1, 11-20 = segment 2, etc.
    const roomInSegment = depth % 10 === 0 ? 10 : depth % 10;

    // Base multiplier increases per segment
    // Segment 1: 1.0, Segment 2: 1.3, Segment 3: 1.6, Segment 4: 2.0, etc.
    const segmentMultiplier = 1 + (segment - 1) * 0.3;

    // Within segment, slight ramp (rooms 1-9 get 0-20% bonus)
    const roomRamp = 1 + (roomInSegment - 1) * 0.025; // 0% at room 1, ~20% at room 9

    const multiplier = segmentMultiplier * roomRamp;

    // Enemy power tier filtering - scales up with 6 tiers now
    // Each segment opens up ~2 more power levels, with overlap for variety
    // Segment 1: 1-2, Segment 2: 2-4, Segment 3: 3-6, Segment 4: 5-8, Segment 5: 7-10, Segment 6+: 9-13
    let minPower: number;
    let maxPower: number;
    
    if (segment === 1) {
        minPower = 1; maxPower = 2;
    } else if (segment === 2) {
        minPower = 2; maxPower = 4;
    } else if (segment === 3) {
        minPower = 3; maxPower = 6;
    } else if (segment === 4) {
        minPower = 5; maxPower = 8;
    } else if (segment === 5) {
        minPower = 7; maxPower = 10;
    } else {
        // Segment 6+: Boss tier unlocked
        minPower = 9; maxPower = 13;
    }

    // AC bonus based on segment (enemies get tougher to hit)
    const acBonus = Math.floor((segment - 1) * 1.5); // +0, +1, +3, +4, +6...

    // Extra enemies in later segments (chance of +1 enemy)
    const enemyCountBonus = Math.floor((segment - 1) / 2); // +0 for seg 1-2, +1 for seg 3-4, etc.

    return {
        segment,
        roomInSegment,
        multiplier,
        minPower,
        maxPower,
        acBonus,
        enemyCountBonus
    };
}

/**
 * Calculate the Escape DC based on:
 * - Base DC: 10
 * - Difficulty scaling: +2 per segment after first
 * - Enemy count: +1 per enemy beyond the first
 * - Elite rooms: +3
 *
 * Party can reduce this with:
 * - Agility: Best agility in party reduces DC
 * - Rogues: Having a rogue gives additional bonus
 */
export function calculateEscapeDC(
    depth: number,
    enemyCount: number,
    isElite: boolean,
    partyAgility: number,
    hasRogue: boolean
): { dc: number; breakdown: string } {
    const difficulty = getDifficulty(depth);

    // Base DC
    let dc = 10;
    const parts: string[] = ['Base: 10'];

    // Segment scaling (+2 per segment after first)
    const segmentBonus = (difficulty.segment - 1) * 2;
    if (segmentBonus > 0) {
        dc += segmentBonus;
        parts.push(`Segment ${difficulty.segment}: +${segmentBonus}`);
    }

    // Enemy count (+1 per enemy beyond first)
    const enemyBonus = Math.max(0, enemyCount - 1);
    if (enemyBonus > 0) {
        dc += enemyBonus;
        parts.push(`Enemies (${enemyCount}): +${enemyBonus}`);
    }

    // Elite room bonus
    if (isElite) {
        dc += 3;
        parts.push('Elite: +3');
    }

    // Party agility reduction (best agility in party)
    if (partyAgility > 0) {
        dc -= partyAgility;
        parts.push(`Agility: -${partyAgility}`);
    }

    // Rogue bonus (additional -2 if party has a rogue)
    if (hasRogue) {
        dc -= 2;
        parts.push('Rogue: -2');
    }

    // Minimum DC of 5
    dc = Math.max(5, dc);

    return {
        dc,
        breakdown: parts.join(', ')
    };
}

export function generateRoom(state: RunState, rng?: SeededRNG): Room {
    // 1. Create RNG for this specific room to ensure isolation/parallelizability (optional but good for 'jump to room' debug)
    
    // Use provided RNG or derive one
    if (!rng) {
         // We derive a seed from (RunSeed + Depth).
         const roomSeed = hashWithSeed(`room-${state.depth}`, parseInt(hashWithSeed(state.seed, 0).toString().substring(0, 8))); 
         rng = new SeededRNG(roomSeed);
    }
    
    // Room in segment: depth 1-9 = rooms 1-9, depth 10 = room 10 (intermission)
    // depth 11-19 = rooms 1-9, depth 20 = room 10, etc.
    const roomInSegment = state.depth % 10 === 0 ? 10 : state.depth % 10;
    const theme = getThemeDef(state.themeId);
    
    // 2. Determine Room Type
    // Schedule:
    // - Every 10 rooms (10, 20, 30...): Intermission (safe, rest/shop)
    // - Every 5 rooms except 10s (0, 5, 15, 25, 35...): Shrine (may be guarded)
    // - Other rooms: Random weighted (combat, elite, hazard, trader)
    let type: RoomType = 'combat';
    let isGuardedRoom = false; // Can be guarded shrine or guarded hazard
    
    if (state.depth % 10 === 0 && state.depth > 0) {
        // Room 10, 20, 30... = Intermission (safe)
        type = 'intermission';
    } else if (state.depth === 0 || state.depth % 5 === 0) {
        // Room 0, 5, 15, 25, 35... = Shrine
        type = 'shrine';
        // Shrines after room 0 may be guarded (30-70% chance based on depth)
        if (state.depth > 0) {
            const guardChance = 0.3 + (state.depth * 0.01); // 30% base, +1% per room
            isGuardedRoom = rng.float() < Math.min(guardChance, 0.7); // Cap at 70%
        }
    } else {
        const weights = getRoomWeights(roomInSegment);
        
        // Weighted random choice
        const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
        let roll = rng.int(1, totalWeight);
        
        for (const w of weights) {
            roll -= w.weight;
            if (roll <= 0) {
                type = w.type;
                break;
            }
        }
        
        // Hazard rooms may also be guarded (25-50% chance based on depth)
        if (type === 'hazard') {
            const guardChance = 0.25 + (state.depth * 0.005); // 25% base, +0.5% per room
            isGuardedRoom = rng.float() < Math.min(guardChance, 0.5); // Cap at 50%
        }
    }
    
    // 3. Generate Content based on Type
    const room: Room = {
        id: `room-${state.depth}`,
        type: type, 
        themeId: state.themeId, 
        enemies: [],
        loot: []
    };
    
    if (type === 'combat' || type === 'elite' || isGuardedRoom) {
        // Get difficulty scaling for this depth
        const difficulty = getDifficulty(state.depth);

        // Filter enemies by theme AND power tier
        const allowedEnemies = ENEMIES.filter(e =>
            e.tags.some(tag => theme.enemyTags.includes(tag)) &&
            e.power >= difficulty.minPower &&
            e.power <= difficulty.maxPower
        );

        // Fallback: if no enemies match both filters, try just power tier
        let pool = allowedEnemies.length > 0
            ? allowedEnemies
            : ENEMIES.filter(e => e.power >= difficulty.minPower && e.power <= difficulty.maxPower);

        // Ultimate fallback: use all enemies
        if (pool.length === 0) pool = ENEMIES;

        // Enemy count: base + possible bonus from difficulty
        // Guarded shrines get fewer enemies (1-2)
        const baseCount = isGuardedRoom ? rng.int(1, 2) : (type === 'elite' ? 1 : rng.int(1, 3));
        const bonusEnemies = isGuardedRoom ? 0 : (rng.float() < 0.5 ? difficulty.enemyCountBonus : 0);
        const count = Math.min(5, baseCount + bonusEnemies); // Cap at 5 enemies
        
        // Track name counts for numbering duplicates
        const nameCounts: Record<string, number> = {};
        
        for(let i=0; i<count; i++) {
            const enemyProto = rng.pick(pool);

            // Increment count for this name
            nameCounts[enemyProto.name] = (nameCounts[enemyProto.name] || 0) + 1;
            const nameNum = nameCounts[enemyProto.name];

            // Only add number if there will be multiple of same type
            const displayName = count > 1 ? `${enemyProto.name} ${nameNum}` : enemyProto.name;

            // Scale enemy stats based on difficulty
            const scaledHp = Math.floor(enemyProto.hp * difficulty.multiplier);
            const scaledAc = 10 + difficulty.acBonus;
            const scaledPower = Math.floor(enemyProto.power * difficulty.multiplier);
            const scaledXp = Math.floor(enemyProto.power * 10 * difficulty.multiplier);

            // Elite enemies get bonus stats
            const eliteBonus = type === 'elite' ? 1.5 : 1;
            const finalHp = Math.floor(scaledHp * eliteBonus);
            const finalAc = type === 'elite' ? scaledAc + 2 : scaledAc;
            const finalPower = Math.floor(scaledPower * eliteBonus);

            room.enemies!.push({
                ...enemyProto,
                id: `${enemyProto.id}-${i}`,
                name: type === 'elite' ? `Elite ${displayName}` : displayName,
                hp: finalHp,
                maxHp: finalHp,
                ac: finalAc,
                power: finalPower,
                xp: Math.floor(scaledXp * eliteBonus)
            });
        }
    }
    
    // Generate treasure for hazard rooms (traps have treasure!)
    if (type === 'hazard') {
        
        // Filter items by rarity based on whether room is guarded
        // Guarded hazards have better loot
        const rarityFilter = isGuardedRoom 
            ? ['uncommon', 'rare', 'epic'] 
            : ['common', 'uncommon'];
        
        const lootPool = ITEMS.filter(i => rarityFilter.includes(i.rarity));
        const shuffledLoot = [...lootPool].sort(() => rng.float() - 0.5);
        
        // Guarded hazards: 2-3 items, unguarded: 1 item
        const lootCount = isGuardedRoom ? rng.int(2, 3) : 1;
        room.loot = shuffledLoot.slice(0, lootCount);
    }
    
    // Generate shop items for trader and intermission rooms
    if (type === 'trader' || type === 'intermission') {
        const shuffled = [...ITEMS].sort(() => rng.float() - 0.5);
        room.shopItems = shuffled.slice(0, 4);
    }

    // Generate available recruits for intermission rooms
    if (type === 'intermission') {
        const difficulty = getDifficulty(state.depth);
        const segment = difficulty.segment;
        
        // Recruits level = segment (so segment 3 = level 3)
        // Cost scales with level (+15 gold per level above 1)
        const scaledRecruits = RECRUITS.map(r => ({
            ...r,
            level: segment,
            cost: r.cost + (segment - 1) * 15,
            description: `${r.description} (Level ${segment})`
        }));
        
        const shuffledRecruits = [...scaledRecruits].sort(() => rng.float() - 0.5);
        room.availableRecruits = shuffledRecruits.slice(0, 2);
        
        // Generate optional BOSS ROOM challenge
        // Boss is 1.5x stronger with 1-2 minions
        // Loot is rare+ only (no common/uncommon)
        // Defeating boss grants a rare+ shrine blessing
        const bossRoom: Room = {
            id: `boss-room-${state.depth}`,
            type: 'boss',
            themeId: state.themeId,
            enemies: [],
            loot: []
        };
        
        // Find a boss-tagged enemy or use the strongest available
        // Find a suitable boss-tier enemy
        // Must be STRICTLY stronger than normal max tier (to avoid weak Bandit bosses)
        // Range: [MaxPower + 1, MaxPower + 3]
        // e.g. Floor 1 (Power 1-2) -> Boss (Power 3-5) -> Skeleton/Orc instead of Bandit
        let potentialBosses = ENEMIES.filter(e => 
            e.power >= difficulty.maxPower + 1 && 
            e.power <= difficulty.maxPower + 3
        );
        
        // If no bosses in that specific range, accept current max tier as fallback
        if (potentialBosses.length === 0) {
            potentialBosses = ENEMIES.filter(e => 
                e.power >= difficulty.maxPower && 
                e.power <= difficulty.maxPower + 3
            );
        }
        
        // Filter for preferred tags if possible
        const preferredBosses = potentialBosses.filter(e => e.tags.includes('boss') || e.tags.includes('elite'));
        const finalBossPool = preferredBosses.length > 0 ? preferredBosses : potentialBosses;
        
        const bossProto = finalBossPool.length > 0
            ? rng.pick(finalBossPool)
            : ENEMIES.find(e => e.power === difficulty.maxPower) || ENEMIES[0]; // Fallback to max power of current tier
        
        // Boss scaled 1.5x HP, 1.25x Power (Buffed from 1.3/1.2)
        const bossMultiplier = difficulty.multiplier;
        const bossHp = Math.floor(bossProto.hp * bossMultiplier * 1.5);
        const bossAc = 12 + difficulty.acBonus + 1; // Keep AC manageable
        const bossPower = Math.floor(bossProto.power * bossMultiplier * 1.25);
        
        bossRoom.enemies!.push({
            ...bossProto,
            id: `${bossProto.id}-boss`,
            name: `${bossProto.name} (BOSS)`,
            hp: bossHp,
            maxHp: bossHp,
            ac: bossAc,
            power: bossPower,
            xp: Math.floor(bossProto.power * 25 * difficulty.multiplier)
        });
        
        // Add 1-2 minions (Restored from 0-1)
        const minionPool = ENEMIES.filter(e => 
            !e.tags.includes('boss') && 
            e.power >= difficulty.minPower && 
            e.power <= difficulty.maxPower
        );
        const minionCount = rng.int(1, 2);
        for (let i = 0; i < minionCount && minionPool.length > 0; i++) {
            const minionProto = rng.pick(minionPool);
            const minionHp = Math.floor(minionProto.hp * difficulty.multiplier);
            bossRoom.enemies!.push({
                ...minionProto,
                id: `${minionProto.id}-minion-${i}`,
                name: `${minionProto.name}`,
                hp: minionHp,
                maxHp: minionHp,
                ac: 10 + difficulty.acBonus,
                power: Math.floor(minionProto.power * difficulty.multiplier),
                xp: Math.floor(minionProto.power * 10 * difficulty.multiplier)
            });
        }
        
        // Boss room loot: rare+ only (3-5 items)
        const rareLootPool = ITEMS.filter(i => 
            ['rare', 'epic', 'legendary', 'godly'].includes(i.rarity)
        );
        const shuffledBossLoot = [...rareLootPool].sort(() => rng.float() - 0.5);
        bossRoom.loot = shuffledBossLoot.slice(0, rng.int(3, 5));
        
        room.bossRoom = bossRoom;
    }

    return room;
}


