CREATE TABLE IF NOT EXISTS saves (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    save_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    score INTEGER NOT NULL,
    run_data JSONB,
    -- Extracted stats for efficient leaderboard queries
    depth INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    highest_hit INTEGER DEFAULT 0,
    critical_hits INTEGER DEFAULT 0,
    max_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for each leaderboard category
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_depth ON scores(depth DESC);
CREATE INDEX IF NOT EXISTS idx_scores_gold ON scores(gold DESC);
CREATE INDEX IF NOT EXISTS idx_scores_kills ON scores(total_kills DESC);
CREATE INDEX IF NOT EXISTS idx_scores_hit ON scores(highest_hit DESC);
CREATE INDEX IF NOT EXISTS idx_scores_crits ON scores(critical_hits DESC);
CREATE INDEX IF NOT EXISTS idx_scores_level ON scores(max_level DESC);
CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id);
