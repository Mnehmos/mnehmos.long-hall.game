import { Router } from 'express';
import { pool } from '../db/index.js';
import { generateSaveHash } from '../utils/hash.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Auth is applied by the parent router (see index.ts).
const saveLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'saves' });

// GET /api/saves - Get latest save
router.get('/', saveLimit, async (req, res) => {
  const { userId } = req.auth;

  if (!userId) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    const result = await pool.query(
      'SELECT data, save_hash, updated_at FROM saves WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
       res.status(404).json({ error: 'No save found' });
       return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching save:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/saves - Create/Update save
router.post('/', saveLimit, async (req, res) => {
  const { userId } = req.auth;
  const { data } = req.body;

  if (!userId) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  // The client sends { data: <RunState> }. Reject anything that isn't at least
  // shaped like a run, so we don't persist arbitrary JSON under a user id.
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || typeof data.seed !== 'string' || !data.party) {
     res.status(400).json({ error: 'Missing or malformed save data' });
     return;
  }

  // Generate hash on server side for integrity
  const saveHash = generateSaveHash(data);

  try {
    const result = await pool.query(
      `INSERT INTO saves (user_id, data, save_hash, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET data = $2, save_hash = $3, updated_at = NOW()
       RETURNING updated_at`,
      [userId, data, saveHash]
    );

    res.json({ success: true, updatedAt: result.rows[0].updated_at, hash: saveHash });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
