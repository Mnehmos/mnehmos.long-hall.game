# Server + High Score System Implementation Plan

## Overview
Add a server directory to the monorepo with Railway deployment, Clerk authentication, and a high score system with hash-based save state validation.

## Decisions Made
- **Database**: Railway PostgreSQL add-on
- **High Score Data**: Depth + Gold
- **Validation**: Hash-based (server generates hash, client must match on submit)
- **Auth**: Clerk with environment variables for public/secret keys

---

## Directory Structure

```
server/
├── src/
│   ├── index.ts              # Express server entry
│   ├── routes/
│   │   ├── auth.ts           # Clerk auth middleware
│   │   ├── saves.ts          # Save state CRUD + hash generation
│   │   └── highscores.ts     # High scores GET/POST
│   ├── db/
│   │   ├── schema.sql        # PostgreSQL schema
│   │   └── client.ts         # Database connection
│   └── utils/
│       └── hash.ts           # State hash generation
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
.github/
└── workflows/
    └── deploy.yml            # Railway deployment
```

---

## Step 1: Server Setup

### Files to Create

**server/package.json**
- Express + TypeScript server
- @clerk/express for auth
- pg for PostgreSQL
- cors for frontend access

**server/src/index.ts**
- Express server on PORT from env
- CORS for frontend origin
- Clerk middleware for auth
- Routes: `/api/saves`, `/api/highscores`

---

## Step 2: Database Schema

**server/src/db/schema.sql**
```sql
-- Users table (synced from Clerk)
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- Clerk user ID
  username TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- High scores table
CREATE TABLE highscores (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  depth INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  seed TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT TRUE
);

-- Save states table
CREATE TABLE saves (
  id SERIAL PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id),
  state_json JSONB NOT NULL,
  state_hash TEXT NOT NULL,       -- Server-generated hash
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_highscores_depth ON highscores(depth DESC);
CREATE INDEX idx_highscores_user ON highscores(user_id);
```

---

## Step 3: Hash-Based Validation

**Approach:**
1. When client saves state, server generates a SHA-256 HMAC hash of canonical state
2. Hash is stored in DB alongside the save
3. When submitting high score, client sends current state
4. Server re-hashes and compares to stored hash
5. If match → valid, if mismatch → flagged as invalid

**Hash includes**: seed, depth, gold, gameOver (core immutable data)

---

## Step 4: API Routes

### Saves API
- `GET /api/saves` - Get current save for authenticated user
- `PUT /api/saves` - Update save (returns new hash)
- `DELETE /api/saves` - Delete save (on game over)

### High Scores API
- `GET /api/highscores` - Get top 100 scores
- `GET /api/highscores/me` - Get user's best scores
- `POST /api/highscores` - Submit score (validates hash)

---

## Step 5: Clerk Integration

**Railway Environment Variables:**
```
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
DATABASE_URL=postgresql://...
STATE_HASH_SECRET=random-secret-for-hmac
FRONTEND_URL=https://thelonghall.app
```

Clerk Express middleware extracts `userId` from JWT.
Auto-create user record on first authenticated request.

---

## Step 6: Frontend Integration

**Modify: src/engine/state.ts**
- Add `syncSaveToServer(state)` function
- Add `loadSaveFromServer()` function
- Add `submitHighScore(state)` function

**Modify: src/main.ts**
- On dispatch, sync to server if authenticated
- On load, prefer server save over localStorage
- On game over, submit high score

**New: src/api/client.ts**
- Fetch wrapper with Clerk token
- API calls for saves and high scores

---

## Step 7: Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Step 8: GitHub Actions

**.github/workflows/deploy.yml**
- Trigger on push to main (server/** paths)
- Use Railway CLI for deployment
- Requires RAILWAY_TOKEN secret

---

## Implementation Order

1. [ ] Create server directory structure
2. [ ] Set up Express + TypeScript + Clerk
3. [ ] Create PostgreSQL schema
4. [ ] Implement saves API with hash generation
5. [ ] Implement high scores API with validation
6. [ ] Create Dockerfile
7. [ ] Add GitHub Actions workflow
8. [ ] Update frontend with API client
9. [ ] Add Clerk React components for login
10. [ ] Test end-to-end flow

---

## Files to Modify (Frontend)

| File | Changes |
|------|---------|
| `package.json` | Add `@clerk/clerk-react` dependency |
| `src/main.ts` | Add server sync on dispatch |
| `src/engine/state.ts` | Add API sync functions |
| `index.html` | Add Clerk provider |

## Files to Create (Server)

| File | Purpose |
|------|---------|
| `server/package.json` | Server dependencies |
| `server/tsconfig.json` | TypeScript config |
| `server/src/index.ts` | Express entry point |
| `server/src/routes/saves.ts` | Save state API |
| `server/src/routes/highscores.ts` | High scores API |
| `server/src/db/schema.sql` | Database schema |
| `server/src/db/client.ts` | Postgres connection |
| `server/src/utils/hash.ts` | State hash utility |
| `server/Dockerfile` | Container config |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
