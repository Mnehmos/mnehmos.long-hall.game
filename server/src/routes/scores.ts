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

// GET /api/scores - Get leaderboard
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

  try {
    const result = await pool.query(
      `SELECT user_id, display_name, score, run_data, created_at
       FROM scores
       ORDER BY score DESC
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
          `UPDATE scores SET score = $1, run_data = $2, display_name = $3, created_at = CURRENT_TIMESTAMP WHERE user_id = $4`,
          [calculatedScore, sanitizedRunData, sanitizedName, userId]
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
        `INSERT INTO scores (user_id, display_name, score, run_data)
         VALUES ($1, $2, $3, $4)`,
        [userId, sanitizedName, calculatedScore, sanitizedRunData]
      );
      res.json({ success: true, score: calculatedScore, newHighScore: true });
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
