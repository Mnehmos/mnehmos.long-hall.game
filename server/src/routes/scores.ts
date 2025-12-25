import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '@clerk/express';

const router = Router();

// GET /api/scores - Get leaderboard
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

  try {
    const result = await pool.query(
      `SELECT user_id, score, run_data, created_at 
       FROM scores 
       ORDER BY score DESC 
       LIMIT $1`,
      [limit]
    );

    // In a real app, you might want to join with a users table or fetch user names from Clerk
    // For now, returning user_id is fine, or we can resolve it on the client
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/scores - Submit score
router.post('/', async (req, res) => {
  const { userId } = req.auth;
  const { runData } = req.body;

  if (!userId) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!runData) {
      res.status(400).json({ error: 'Missing run data' });
      return;
  }

  try {
    // Anti-Cheat: Calculate score from runData on server
    // We import this dynamically or assume it's available from the shared engine code
    // Since we copied it to ../engine/score.js (transpiled), we can use it.
    // Note: We need to use dynamic import or ensure paths are correct.
    const { calculateScore } = await import('../engine/score.js');
    const calculatedScore = calculateScore(runData);

    await pool.query(
      `INSERT INTO scores (user_id, score, run_data)
       VALUES ($1, $2, $3)`,
      [userId, calculatedScore, runData]
    );

    res.json({ success: true, score: calculatedScore });
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
