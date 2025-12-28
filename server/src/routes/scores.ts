import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '@clerk/express';

const router = Router();

// Privacy: Strip last names from display names (only return first word)
// This protects users who submitted full names before the client-side fix
function sanitizeDisplayName(name: string | null): string | null {
  if (!name) return null;
  // If name contains a space, only return the first word (first name)
  const firstWord = name.split(' ')[0];
  return firstWord || null;
}

// Extract stats from runData for leaderboard categories
function extractStats(runData: any) {
  const depth = runData?.depth || 0;
  const gold = runData?.party?.gold || 0;
  const maxLevel = Math.max(...(runData?.party?.members?.map((m: any) => m.level) || [1]));
  
  // Aggregate weapon stats
  let totalKills = 0;
  let highestHit = 0;
  let criticalHits = 0;
  
  // From inventory items
  runData?.inventory?.items?.forEach((item: any) => {
    if (item.stats) {
      totalKills += item.stats.kills || 0;
      highestHit = Math.max(highestHit, item.stats.highestHit || 0);
      criticalHits += item.stats.criticalHits || 0;
    }
  });
  
  // From equipped items on party members
  runData?.party?.members?.forEach((member: any) => {
    Object.values(member.equipment || {}).forEach((item: any) => {
      if (item?.stats) {
        totalKills += item.stats.kills || 0;
        highestHit = Math.max(highestHit, item.stats.highestHit || 0);
        criticalHits += item.stats.criticalHits || 0;
      }
    });
  });
  
  return { depth, gold, totalKills, highestHit, criticalHits, maxLevel };
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

// GET /api/scores - Get leaderboard with category support
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const category = (req.query.category as string) || 'score';
  
  // Validate category to prevent SQL injection
  const orderBy = ORDER_BY_MAP[category] || 'score DESC';

  try {
    const result = await pool.query(
      `SELECT user_id, display_name, score, depth, gold, total_kills, highest_hit, critical_hits, max_level, run_data, created_at
       FROM scores
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );

    // Sanitize display names before returning (privacy protection)
    const sanitizedRows = result.rows.map(row => ({
      ...row,
      display_name: sanitizeDisplayName(row.display_name)
    }));

    res.json(sanitizedRows);
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/scores/weapons - Get top weapons leaderboard
router.get('/weapons', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  
  try {
    const result = await pool.query(`
      SELECT display_name, run_data
      FROM scores
      WHERE run_data IS NOT NULL
    `);
    
    interface WeaponEntry {
      name: string;
      rarity: string;
      kills: number;
      damageDealt: number;
      highestHit: number;
      criticalHits: number;
      owner: string;
    }
    
    const weapons: WeaponEntry[] = [];
    
    result.rows.forEach(row => {
      const runData = row.run_data;
      const playerName = sanitizeDisplayName(row.display_name) || 'Anonymous';
      
      // Collect weapons from inventory and equipment
      const collectItems = (items: any[]) => {
        items?.forEach(item => {
          if (item?.stats && item.type === 'weapon') {
            weapons.push({
              name: item.customName || item.name,
              rarity: item.rarity || 'common',
              kills: item.stats.kills || 0,
              damageDealt: item.stats.damageDealt || 0,
              highestHit: item.stats.highestHit || 0,
              criticalHits: item.stats.criticalHits || 0,
              owner: playerName
            });
          }
        });
      };
      
      collectItems(runData?.inventory?.items);
      runData?.party?.members?.forEach((m: any) =>
        collectItems(Object.values(m.equipment || {}))
      );
    });
    
    // Sort by kills (primary), then by highest hit (secondary)
    weapons.sort((a, b) => b.kills - a.kills || b.highestHit - a.highestHit);
    
    res.json(weapons.slice(0, limit));
  } catch (error) {
    console.error('Error fetching weapons:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/scores - Submit score (protected)
router.post('/', requireAuth(), async (req, res) => {
  const { userId } = req.auth;
  const { runData, displayName } = req.body;

  if (!userId) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!runData) {
      res.status(400).json({ error: 'Missing run data' });
      return;
  }

  // Sanitize display name (limit length, remove dangerous chars)
  const sanitizedName = displayName
    ? String(displayName).slice(0, 50).replace(/[<>]/g, '')
    : null;

  try {
    // Anti-Cheat: Calculate score from runData on server
    const { calculateScore } = await import('../engine/score.js');
    const calculatedScore = calculateScore(runData);
    
    // Extract stats for category leaderboards
    const stats = extractStats(runData);

    // Sanitize runData before storing - strip large arrays to save space
    const sanitizedRunData = {
      ...runData,
      history: runData.history?.slice(-20) || [], // Keep only last 20 for audit
      currentRoom: runData.currentRoom ? {
        ...runData.currentRoom,
        enemies: [] // Don't need enemy state for scores
      } : null
    };

    // Check if user already has a score
    const existing = await pool.query(
      `SELECT id, score FROM scores WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      // Only update if new score is higher
      if (calculatedScore > existing.rows[0].score) {
        await pool.query(
          `UPDATE scores SET
            score = $1,
            run_data = $2,
            display_name = $3,
            depth = $4,
            gold = $5,
            total_kills = $6,
            highest_hit = $7,
            critical_hits = $8,
            max_level = $9,
            created_at = CURRENT_TIMESTAMP
          WHERE user_id = $10`,
          [calculatedScore, sanitizedRunData, sanitizedName,
           stats.depth, stats.gold, stats.totalKills, stats.highestHit, stats.criticalHits, stats.maxLevel,
           userId]
        );
        res.json({ success: true, score: calculatedScore, newHighScore: true });
      } else {
        // Score not higher, don't update but still update display name if provided
        if (sanitizedName) {
          await pool.query(
            `UPDATE scores SET display_name = $1 WHERE user_id = $2`,
            [sanitizedName, userId]
          );
        }
        res.json({ success: true, score: calculatedScore, newHighScore: false, currentBest: existing.rows[0].score });
      }
    } else {
      // First score for this user
      await pool.query(
        `INSERT INTO scores (user_id, display_name, score, run_data, depth, gold, total_kills, highest_hit, critical_hits, max_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, sanitizedName, calculatedScore, sanitizedRunData,
         stats.depth, stats.gold, stats.totalKills, stats.highestHit, stats.criticalHits, stats.maxLevel]
      );
      res.json({ success: true, score: calculatedScore, newHighScore: true });
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
