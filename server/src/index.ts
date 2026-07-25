import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import { initializeDatabase } from './db/init.js';
import savesRouter from './routes/saves.js';
import scoresRouter from './routes/scores.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Behind Railway's proxy, so req.ip reflects the client rather than the proxy.
// The rate limiter keys on it.
app.set('trust proxy', 1);
app.disable('x-powered-by');

/**
 * Baseline security headers.
 *
 * Hand-rolled rather than pulling in helmet, to keep the dependency surface
 * unchanged. This is a JSON API with no HTML responses, so the CSP is
 * deliberately restrictive.
 */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

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
app.get('/health', (_req, res) => {
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

// 404 for unknown API routes, so they don't fall through to the error handler.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware. Express identifies this by its four-arg signature,
// so `next` must stay even though it is unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err?.stack || err);
  // Don't leak stack traces or internal messages to clients.
  res.status(err?.status || 500).json({ error: 'Internal server error' });
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    // Railway sends SIGTERM on redeploy; finish in-flight requests first.
    const shutdown = (signal: string) => () => {
      console.log(`${signal} received, shutting down`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', shutdown('SIGTERM'));
    process.on('SIGINT', shutdown('SIGINT'));
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
