/**
 * Validation and sanitisation for client-submitted run data.
 *
 * Everything in `runData` is attacker-controlled: it arrives verbatim from the
 * browser. Two separate problems follow from that.
 *
 * 1. STORED XSS. Item names include `customName`, which the player types into a
 *    `prompt()`. Those names are served back to every other player on the
 *    weapons leaderboard. The client escapes on render now, but we also strip
 *    markup here so a payload never reaches the database in the first place.
 *
 * 2. SCORE INFLATION. `calculateScore` derives the score from fields the client
 *    asserts (depth, gold, level, xp). Clamping to what the rules can actually
 *    produce at a given depth bounds the damage. It does NOT make scores
 *    trustworthy -- that needs the server to replay the run from its seed and
 *    action log, which the engine is now deterministic enough to support.
 */

/** C0 controls, DEL, and C1 controls. Built from escapes so the source stays ASCII. */
const CONTROL_CHARS = new RegExp('[\u0000-\u001F\u007F-\u009F]', 'g');

/** Strip markup characters and control codes, and bound the length. */
export function cleanString(value: unknown, maxLength = 60): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>&"'`\\]/g, '')
    // Strip C0/C1 control characters and DEL.
    .replace(CONTROL_CHARS, '')
    .trim()
    .slice(0, maxLength);
}

function finiteInt(value: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/**
 * Ceilings, calibrated against real submitted runs with generous headroom.
 *
 * Reference point from production: a depth-40 run finished with 166 gold,
 * 1609 XP, level 7, 50 kills and a best hit of 14. The per-depth rates below
 * sit roughly two orders of magnitude above that, so honest play is never
 * clipped while a fabricated payload cannot claim an absurd score.
 *
 * The `floor` values keep shallow runs from being over-clamped (at depth 1 a
 * depth-scaled cap would be tighter than what one good hit can produce).
 */
const LIMITS = {
  depth: 500,
  maxPartyMembers: 4,
  maxItems: 200,
  maxLevel: 9,
  goldPerDepth: 500, goldFloor: 1_000,
  xpPerDepth: 500, xpFloor: 2_000,
  hitPerDepth: 10, hitFloor: 100,
  killsPerDepth: 10, killsFloor: 50,
};

/** Cap that scales with depth but never falls below `floor`. */
function depthCap(depth: number, perDepth: number, floor: number): number {
  return Math.max(floor, depth * perDepth);
}

interface CleanItem {
  id: string;
  name: string;
  customName?: string;
  type: string;
  rarity: string;
  cost: number;
  stats?: {
    kills: number;
    damageDealt: number;
    highestHit: number;
    criticalHits: number;
    encountersUsed: number;
  };
}

function cleanItem(raw: any, depth: number): CleanItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item: CleanItem = {
    id: cleanString(raw.id, 80),
    name: cleanString(raw.name, 80) || 'Unknown Item',
    type: cleanString(raw.type, 20),
    rarity: cleanString(raw.rarity, 20),
    cost: finiteInt(raw.cost, 0, 100_000),
  };
  const custom = cleanString(raw.customName, 40);
  if (custom) item.customName = custom;

  if (raw.stats && typeof raw.stats === 'object') {
    const killCap = depthCap(depth, LIMITS.killsPerDepth, LIMITS.killsFloor);
    const hitCap = depthCap(depth, LIMITS.hitPerDepth, LIMITS.hitFloor);
    item.stats = {
      kills: finiteInt(raw.stats.kills, 0, killCap),
      damageDealt: finiteInt(raw.stats.damageDealt, 0, killCap * hitCap),
      highestHit: finiteInt(raw.stats.highestHit, 0, hitCap),
      criticalHits: finiteInt(raw.stats.criticalHits, 0, killCap),
      encountersUsed: finiteInt(raw.stats.encountersUsed, 0, Math.max(50, depth * 10)),
    };
  }
  return item;
}

export interface CleanRunData {
  seed: string;
  depth: number;
  party: {
    gold: number;
    members: Array<{
      name: string;
      role: string;
      level: number;
      xp: number;
      equipment: Record<string, CleanItem>;
    }>;
  };
  inventory: { items: CleanItem[] };
  history: string[];
}

/**
 * Validate and normalise a submitted run. Returns null if the payload is not
 * plausibly a run at all.
 */
export function sanitizeRunData(raw: any): CleanRunData | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.party || !Array.isArray(raw.party.members) || raw.party.members.length === 0) {
    return null;
  }

  const depth = finiteInt(raw.depth, 0, LIMITS.depth);

  const members = raw.party.members
    .slice(0, LIMITS.maxPartyMembers)
    .map((m: any) => {
      const equipment: Record<string, CleanItem> = {};
      if (m?.equipment && typeof m.equipment === 'object') {
        for (const [slot, item] of Object.entries(m.equipment).slice(0, 12)) {
          const cleaned = cleanItem(item, depth);
          if (cleaned) equipment[cleanString(slot, 20)] = cleaned;
        }
      }
      return {
        name: cleanString(m?.name, 40) || 'Adventurer',
        role: cleanString(m?.role, 20),
        level: finiteInt(m?.level, 1, LIMITS.maxLevel, 1),
        xp: finiteInt(m?.xp, 0, depthCap(depth, LIMITS.xpPerDepth, LIMITS.xpFloor)),
        equipment,
      };
    });

  const items = Array.isArray(raw.inventory?.items)
    ? raw.inventory.items
        .slice(0, LIMITS.maxItems)
        .map((i: any) => cleanItem(i, depth))
        .filter((i: CleanItem | null): i is CleanItem => i !== null)
    : [];

  return {
    seed: cleanString(raw.seed, 64),
    depth,
    party: {
      gold: finiteInt(raw.party.gold, 0, depthCap(depth, LIMITS.goldPerDepth, LIMITS.goldFloor)),
      members,
    },
    inventory: { items },
    // Keep a short tail for auditing; the log embeds item names, so clean it.
    history: Array.isArray(raw.history)
      ? raw.history.slice(-20).map((h: unknown) => cleanString(h, 200))
      : [],
  };
}

/** Aggregate the leaderboard category columns from an already-clean run. */
export function extractStats(run: CleanRunData) {
  let totalKills = 0;
  let highestHit = 0;
  let criticalHits = 0;

  const collect = (items: CleanItem[]) => {
    for (const item of items) {
      if (!item.stats) continue;
      totalKills += item.stats.kills;
      highestHit = Math.max(highestHit, item.stats.highestHit);
      criticalHits += item.stats.criticalHits;
    }
  };

  collect(run.inventory.items);
  for (const member of run.party.members) {
    collect(Object.values(member.equipment));
  }

  // Math.max() over an empty list is -Infinity, which fails the INTEGER insert
  // and 500s the request. Seed the reduce instead of spreading.
  const maxLevel = run.party.members.reduce((best, m) => Math.max(best, m.level), 1);

  return { depth: run.depth, gold: run.party.gold, totalKills, highestHit, criticalHits, maxLevel };
}
