# The Long Hall

A procedural roguelike dungeon crawler with ironman saves, cloud leaderboards, and RPG-inspired progression.

🎮 **[Play Now](https://mnehmos.github.io/mnehmos.long-hall.game/)**

---

## Overview

The Long Hall is a browser-based roguelike where you lead a party of adventurers through an endless dungeon. Each run is procedurally generated from a seed, creating unique challenges while maintaining reproducible gameplay for speedrunning and competitive play.

### Key Features

- **5 Character Classes**: Fighter, Wizard, Rogue, Cleric, Ranger - each with unique abilities and stat distributions
- **Turn-Based Combat**: D&D-inspired mechanics with attack rolls, damage dice, and armor class
- **Ironman Saves**: Your progress auto-saves, but death is permanent
- **Cloud Leaderboards**: Compete globally with authenticated score submission
- **Equipment System**: Items with rarities, enchantments, and mastery tracking
- **Procedural Generation**: Seeded RNG ensures consistent room generation across sessions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Vite + TS)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Engine    │  │   Content   │  │         UI          │ │
│  │  - reducer  │  │  - classes  │  │  - render           │ │
│  │  - combat   │  │  - abilities│  │  - leaderboard      │ │
│  │  - state    │  │  - themes   │  │  - input handlers   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                           │                                 │
│                    Clerk Auth (clerk-js)                    │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│                    Backend (Express + TS)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Routes    │  │  Middleware │  │       Database      │ │
│  │  - /saves   │  │  - clerk    │  │  - PostgreSQL       │ │
│  │  - /scores  │  │  - cors     │  │  - saves table      │ │
│  │             │  │  - auth     │  │  - scores table     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, TypeScript, Clerk JS |
| Backend | Express, TypeScript, PostgreSQL |
| Auth | Clerk (SSO, JWT) |
| Hosting | GitHub Pages (frontend), Railway (backend) |

---

## Game Mechanics

### Classes

| Class | Hit Die | Primary Stats | Special |
|-------|---------|---------------|---------|
| Fighter | d10 | STR, ATK, DEF | High survivability |
| Ranger | d10 | RNG, AGI, FTH | Ranged specialist |
| Cleric | d8 | STR, DEF, FTH | Healing, shrine luck |
| Rogue | d8 | ATK, RNG, AGI | Escape artist |
| Wizard | d6 | MAG | Spell damage |

### Skills

- **Strength**: Melee damage bonus
- **Attack**: Melee hit chance
- **Defense**: AC bonus
- **Magic**: Spell hit & damage
- **Ranged**: Ranged hit & damage
- **Faith**: Healing power, shrine luck
- **Agility**: Escape chance, initiative

### Room Types

| Type | Description |
|------|-------------|
| Combat | Standard enemy encounter |
| Elite | Tough enemy with better loot |
| Hazard | Trap that can be disarmed |
| Trader | Buy items with gold |
| Ally | Recruit new party members |
| Shrine | Pray for random boons |
| Intermission | Rest, hire, shop between segments |

---

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL (for local backend development)
- Clerk account (for auth)

### Frontend

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Backend

```bash
cd server

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your Clerk keys and PostgreSQL URL

# Build
npm run build

# Start server
npm start
```

### Environment Variables

**Frontend** (via GitHub Secrets for CI):
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `VITE_API_URL` - Backend API URL

**Backend** (Railway or local `.env`):
- `CLERK_SECRET_KEY` - Clerk secret key
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3000)

---

## Deployment

### Frontend → GitHub Pages

The frontend automatically deploys via GitHub Actions on push to `main`. The workflow:

1. Builds with Vite
2. Injects environment variables
3. Deploys to GitHub Pages

### Backend → Railway

The backend is containerized and deployed to Railway:

```bash
cd server
railway up
```

Ensure these Railway environment variables are set:
- `CLERK_SECRET_KEY`
- `DATABASE_URL` (Railway provides this automatically with PostgreSQL addon)

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api/scores` | No | Get leaderboard |
| POST | `/api/scores` | Yes | Submit score |
| GET | `/api/saves` | Yes | Get user saves |
| POST | `/api/saves` | Yes | Save game state |
| DELETE | `/api/saves` | Yes | Delete save |

---

## Project Structure

```
mnehmos.long-hall.game/
├── src/                    # Frontend source
│   ├── api/               # API client
│   ├── content/           # Game content (classes, abilities, themes)
│   ├── core/              # Core utilities (dice, RNG, hash)
│   ├── engine/            # Game logic (combat, state, reducer)
│   ├── ui/                # Rendering and UI
│   └── main.ts            # Entry point
├── server/                # Backend source
│   └── src/
│       ├── db/            # Database initialization
│       ├── engine/        # Score calculation
│       ├── routes/        # API routes
│       └── index.ts       # Server entry
├── tests/                 # Test suite
├── public/                # Static assets
└── .github/workflows/     # CI/CD
```

---

## License

MIT

---

## Links

- **Play**: https://mnehmos.github.io/mnehmos.long-hall.game/
- **Backend**: https://the-long-hall-production.up.railway.app
- **Author**: [@Mnehmos](https://github.com/Mnehmos)
