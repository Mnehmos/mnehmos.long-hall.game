import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '@clerk/express';
import { calculateScore } from '../engine/score.js';
import { sanitizeRunData, extractStats, cleanString } from '../utils/sanitize.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Privacy: Strip last names from display names (only return first word)
// This protects users who submitted full names before the client-side fix
function sanitizeDisplayName(name: string | null): string | null {
  if (!name) return null;
  const firstWord = cleanString(name, 40).split(' ')[0];
  return firstWord || null;
}

// Valid order-by columns for category leaderboards
const ORDER_BY_MAP: Record<string, string> = {
  'score': 'score DESC',
  'depth': 'depth DESC',
  'gold': 'gold DESC',
  'kills': 'total_kills DESC',
  'hit': 'highest_hit DESC',
  'crits': 'critical_hits DESC',
  'level': 'max_level DESC'
};

const readLimit = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: 'scores-read' });
const writeLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'scores-write' });

// GET /api/scores - Get leaderboard with category support
router.get('/', readLimit, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const category = (req.query.category as string) || 'score';

  // Validate category to prevent SQL injection
  const orderBy = ORDER_BY_MAP[category] || 'score DESC';

  try {
    // Deliberately NOT selecting run_data or user_id. This endpoint is public,
    // and it used to hand out every player's full run (party, inventory,
    // equipment) plus their Clerk user id to any anonymous caller.
    const result = await pool.query(
      `SELECT display_name, score, depth, gold, total_kills, highest_hit, critical_hits, max_level, created_at
       FROM scores
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows.map(row => ({
      ...row,
      display_name: sanitizeDisplayName(row.display_name)
    })));
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface WeaponEntry {
  name: string;
  rarity: string;
  kills: number;
  damageDealt: number;
  highestHit: number;
  criticalHits: number;
  owner: string;
}

/**
 * The weapons board is derived from every stored run, which means a full table
 * scan plus JSON parsing on each request. Cache it briefly and bound the scan
 * so the cost stays flat as the table grows.
 */
const WEAPONS_CACHE_MS = 60_000;
const WEAPONS_SCAN_LIMIT = 500;
let weaponsCache: { at: number; entries: WeaponEntry[] } | null = null;

async function computeTopWeapons(): Promise<WeaponEntry[]> {
  const result = await pool.query(
    `SELECT display_name, run_data
     FROM scores
     WHERE run_data IS NOT NULL
     ORDER BY total_kills DESC
     LIMIT $1`,
    [WEAPONS_SCAN_LIMIT]
  );

  const weapons: WeaponEntry[] = [];

  for (const row of result.rows) {
    const runData = row.run_data;
    const playerName = sanitizeDisplayName(row.display_name) || 'Anonymous';

    const collect = (items: any[]) => {
      items?.forEach(item => {
        if (item?.stats && item.type === 'weapon') {
          weapons.push({
            // Stored data is sanitised on write, but re-clean on read so rows
            // written before that existed can't leak markup.
            name: cleanString(item.customName || item.name, 60) || 'Unnamed',
            rarity: cleanString(item.rarity, 20) || 'common',
            kills: Number(item.stats.kills) || 0,
            damageDealt: Number(item.stats.damageDealt) || 0,
            highestHit: Number(item.stats.highestHit) || 0,
            criticalHits: Number(item.stats.criticalHits) || 0,
            owner: playerName
          });
        }
      });
    };

    collect(runData?.inventory?.items);
    runData?.party?.members?.forEach((m: any) => collect(Object.values(m.equipment || {})));
  }

  weapons.sort((a, b) => b.kills - a.kills || b.highestHit - a.highestHit);
  return weapons.slice(0, 50);
}

// GET /api/scores/weapons - Get top weapons leaderboard
router.get('/weapons', readLimit, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  try {
    if (!weaponsCache || Date.now() - weaponsCache.at > WEAPONS_CACHE_MS) {
      weaponsCache = { at: Date.now(), entries: await computeTopWeapons() };
    }
    res.json(weaponsCache.entries.slice(0, limit));
  } catch (error) {
    console.error('Error fetching weapons:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/scores - Submit score (protected)
router.post('/', requireAuth(), writeLimit, async (req, res) => {
  const { userId } = req.auth;
  const { runData, displayName } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Validate, clamp and strip the submitted run before it touches the database
  // or the scoring function. See utils/sanitize.ts for what this does and does
  // not guarantee.
  const cleanRun = sanitizeRunData(runData);
  if (!cleanRun) {
    res.status(400).json({ error: 'Invalid run data' });
    return;
  }

  const sanitizedName = displayName ? cleanString(displayName, 50) || null : null;

  try {
    const calculatedScore = calculateScore(cleanRun);
    const stats = extractStats(cleanRun);

    const existing = await pool.query(
      `SELECT id, score FROM scores WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      if (calculatedScore > existing.rows[0].score) {
        await pool.query(
          `UPDATE scores SET
            score = $1, run_data = $2, display_name = $3,
            depth = $4, gold = $5, total_kills = $6,
            highest_hit = $7, critical_hits = $8, max_level = $9,
            created_at = CURRENT_TIMESTAMP
          WHERE user_id = $10`,
          [calculatedScore, cleanRun, sanitizedName,
           stats.depth, stats.gold, stats.totalKills, stats.highestHit, stats.criticalHits, stats.maxLevel,
           userId]
        );
        weaponsCache = null; // New high score: the weapons board is stale.
        res.json({ success: true, score: calculatedScore, newHighScore: true });
      } else {
        if (sanitizedName) {
          await pool.query(
            `UPDATE scores SET display_name = $1 WHERE user_id = $2`,
            [sanitizedName, userId]
          );
        }
        res.json({ success: true, score: calculatedScore, newHighScore: false, currentBest: existing.rows[0].score });
      }
    } else {
      await pool.query(
        `INSERT INTO scores (user_id, display_name, score, run_data, depth, gold, total_kills, highest_hit, critical_hits, max_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, sanitizedName, calculatedScore, cleanRun,
         stats.depth, stats.gold, stats.totalKills, stats.highestHit, stats.criticalHits, stats.maxLevel]
      );
      weaponsCache = null;
      res.json({ success: true, score: calculatedScore, newHighScore: true });
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
