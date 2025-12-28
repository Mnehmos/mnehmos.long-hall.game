import { SeededRNG } from '../core/rng';
import type { RunState, Room, RoomType } from './types';
import { getRoomWeights, ENEMIES, ITEMS, RECRUITS } from '../content/tables';
import { getThemeDef } from './generateTheme';
import { hashWithSeed } from '../core/hash';

/**
 * Calculate difficulty scaling based on depth
 * Segment 1 (rooms 1-10): baseline difficulty 1.0
 * Segment 2 (rooms 11-20): difficulty 1.5
 * Segment 3 (rooms 21-30): difficulty 2.0
 * etc.
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

    // Enemy power tier filtering
    // Segment 1: power 1-2, Segment 2: power 2-4, Segment 3: power 3-5, etc.
    const minPower = Math.min(5, segment);
    const maxPower = Math.min(5, segment + 2);

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
    
    // 2. Determing Room Type
    let type: RoomType = 'combat';
    
    if (roomInSegment === 10) {
        // End of segment - Intermission room for rest/shop/recruit
        type = 'intermission';
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
    }
    
    // 3. Generate Content based on Type
    const room: Room = {
        id: `room-${state.depth}`,
        type: type, 
        themeId: state.themeId, 
        enemies: [],
        loot: []
    };
    
    if (type === 'combat' || type === 'elite') {
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
        const baseCount = type === 'elite' ? 1 : rng.int(1, 3);
        const bonusEnemies = rng.float() < 0.5 ? difficulty.enemyCountBonus : 0;
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
    }

    return room;
}


