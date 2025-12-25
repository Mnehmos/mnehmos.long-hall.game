import { Router } from 'express';
import { pool } from '../db';
import { generateSaveHash } from '../utils/hash';
import { requireAuth } from '@clerk/clerk-sdk-node';

const router = Router();

// GET /api/saves - Get latest save
router.get('/', async (req, res) => {
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
router.post('/', async (req, res) => {
  const { userId } = req.auth;
  const { data } = req.body;

  if (!userId) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!data) {
     res.status(400).json({ error: 'Missing save data' });
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
