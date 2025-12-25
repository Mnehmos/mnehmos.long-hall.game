import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClerkExpressRequireAuth, StrictAuthProp } from '@clerk/clerk-sdk-node';
import { pool } from './db';
import savesRouter from './routes/saves';
import scoresRouter from './routes/scores';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Public health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Protected routes
// Note: StrictAuthProp is a type helper, but actual protection is done by the middleware
declare global {
  namespace Express {
    interface Request extends StrictAuthProp {}
  }
}

// Routes
app.use('/api/saves', ClerkExpressRequireAuth(), savesRouter);
app.use('/api/scores', ClerkExpressRequireAuth(), scoresRouter);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
