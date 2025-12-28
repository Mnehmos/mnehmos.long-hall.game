import { pool } from './index.js';

export async function initializeDatabase() {
  try {
    // Create saves table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saves (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        save_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    // Create scores table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        display_name VARCHAR(255),
        score INTEGER NOT NULL,
        run_data JSONB,
        -- Extracted stats
        depth INTEGER DEFAULT 0,
        gold INTEGER DEFAULT 0,
        total_kills INTEGER DEFAULT 0,
        highest_hit INTEGER DEFAULT 0,
        critical_hits INTEGER DEFAULT 0,
        max_level INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add display_name if missing
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'display_name') THEN
          ALTER TABLE scores ADD COLUMN display_name VARCHAR(255);
        END IF;
      END $$;
    `);

    // Migration: Add new stat columns if missing
    const newColumns = [
        ['depth', 'INTEGER DEFAULT 0'],
        ['gold', 'INTEGER DEFAULT 0'],
        ['total_kills', 'INTEGER DEFAULT 0'],
        ['highest_hit', 'INTEGER DEFAULT 0'],
        ['critical_hits', 'INTEGER DEFAULT 0'],
        ['max_level', 'INTEGER DEFAULT 1']
    ];

    for (const [col, type] of newColumns) {
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scores' AND column_name = '${col}') THEN
              ALTER TABLE scores ADD COLUMN ${col} ${type};
            END IF;
          END $$;
        `);
    }

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_depth ON scores(depth DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_gold ON scores(gold DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_kills ON scores(total_kills DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_hit ON scores(highest_hit DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_crits ON scores(critical_hits DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_level ON scores(max_level DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id)`);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
