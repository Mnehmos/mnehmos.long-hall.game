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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add display_name column if it doesn't exist (migration for existing tables)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'scores' AND column_name = 'display_name'
        ) THEN
          ALTER TABLE scores ADD COLUMN display_name VARCHAR(255);
        END IF;
      END $$;
    `);

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC)`);
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
