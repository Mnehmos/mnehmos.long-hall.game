import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import { pool } from './db/index.js';
import { initializeDatabase } from './db/init.js';
import savesRouter from './routes/saves.js';
import scoresRouter from './routes/scores.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://mnehmos.github.io',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '500kb' })); // Reasonable limit for game saves

// Public health check (before auth middleware)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(clerkMiddleware());

// Protected routes
declare global {
  namespace Express {
    interface Request {
      auth: {
        userId: string | null;
        sessionId: string | null;
        getToken: () => Promise<string | null>;
      };
    }
  }
}

// Routes
app.use('/api/saves', requireAuth(), savesRouter);
app.use('/api/scores', scoresRouter); // Auth applied at route level

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
