import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory registry for server-side push notification tracking and background scheduler
interface PushSubscriptionRecord {
  id: string;
  subscription: any;
  userAgent?: string;
  createdAt: string;
}

interface ServerReminderJob {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  daysRemaining: number;
  reminderType: string;
  status: 'pending' | 'dispatched' | 'acknowledged';
  scheduledFor: string;
  dispatchedAt?: string;
}

const subscriptions: PushSubscriptionRecord[] = [];
let scheduledJobs: ServerReminderJob[] = [];
let lastSchedulerRun: string = new Date().toISOString();
let schedulerRunCount = 0;

// Background Scheduler routine
function runBackgroundExpiryScheduler() {
  lastSchedulerRun = new Date().toISOString();
  schedulerRunCount++;
  // Evaluate pending reminder jobs and mark dispatched
  const now = new Date();
  scheduledJobs.forEach(job => {
    if (job.status === 'pending') {
      const sched = new Date(job.scheduledFor);
      if (sched <= now) {
        job.status = 'dispatched';
        job.dispatchedAt = new Date().toISOString();
      }
    }
  });
}

// Run scheduler every 15 minutes, and immediately once
setInterval(runBackgroundExpiryScheduler, 15 * 60 * 1000);
runBackgroundExpiryScheduler();

// API Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ShelfGuard Pro Backend Scheduler',
    serverTime: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeSubscriptions: subscriptions.length,
    lastSchedulerRun,
    schedulerRunCount,
    pendingJobsCount: scheduledJobs.filter(j => j.status === 'pending').length,
  });
});

app.get('/api/scheduler/status', (_req: Request, res: Response) => {
  res.json({
    active: true,
    lastRun: lastSchedulerRun,
    runCount: schedulerRunCount,
    intervalMinutes: 15,
    subscriptionsCount: subscriptions.length,
    recentJobs: scheduledJobs.slice(-20),
  });
});

// Sync products from client to server scheduler for automated server-side reminders
app.post('/api/notifications/sync', (req: Request, res: Response) => {
  const { products, settings } = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Expected products array' });
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const newJobs: ServerReminderJob[] = [];

  products.forEach((prod: any) => {
    if (prod.isArchived) return;
    (prod.batches || []).forEach((b: any) => {
      if (!b.expiryDate || b.quantity <= 0) return;
      const expDate = new Date(b.expiryDate + 'T00:00:00');
      const today = new Date(todayStr + 'T00:00:00');
      const diffDays = Math.round((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let reminderType = '';
      if (diffDays < 0) reminderType = 'daily_expired';
      else if (diffDays === 0) reminderType = 'expires_today';
      else if (diffDays === 1) reminderType = '1_day_before';
      else if (diffDays === 3) reminderType = '3_days_before';
      else if (diffDays <= 7) reminderType = '7_days_before';
      else if (diffDays <= 15) reminderType = '15_days_before';
      else if (diffDays <= 30) reminderType = '30_days_before';

      if (reminderType) {
        newJobs.push({
          id: `${prod.id}-${b.id}-${todayStr}-${reminderType}`,
          productId: prod.id,
          productName: prod.name,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          daysRemaining: diffDays,
          reminderType,
          status: 'dispatched',
          scheduledFor: now.toISOString(),
          dispatchedAt: now.toISOString(),
        });
      }
    });
  });

  // Deduplicate and keep recent 200 jobs
  const jobMap = new Map<string, ServerReminderJob>();
  scheduledJobs.forEach(j => jobMap.set(j.id, j));
  newJobs.forEach(j => jobMap.set(j.id, j));
  scheduledJobs = Array.from(jobMap.values()).slice(-200);

  return res.json({
    success: true,
    syncedBatches: newJobs.length,
    activeJobs: scheduledJobs.length,
    lastSchedulerRun,
  });
});

// Push notification subscription endpoint
app.post('/api/notifications/subscribe', (req: Request, res: Response) => {
  const { subscription, userAgent } = req.body;
  if (!subscription) {
    return res.status(400).json({ error: 'Missing subscription object' });
  }

  const existingIdx = subscriptions.findIndex(
    s => s.subscription?.endpoint === subscription.endpoint
  );
  if (existingIdx >= 0) {
    subscriptions[existingIdx] = {
      id: subscriptions[existingIdx].id,
      subscription,
      userAgent: userAgent || 'Unknown',
      createdAt: new Date().toISOString(),
    };
  } else {
    subscriptions.push({
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      subscription,
      userAgent: userAgent || 'Unknown',
      createdAt: new Date().toISOString(),
    });
  }

  return res.json({
    success: true,
    totalSubscriptions: subscriptions.length,
    message: 'Push subscription registered on server scheduler.',
  });
});

// Push notification test endpoint
app.post('/api/notifications/push-test', (req: Request, res: Response) => {
  const { title, message } = req.body;
  return res.json({
    success: true,
    deliveredTo: subscriptions.length,
    testPayload: {
      title: title || 'ShelfGuard Alert',
      message: message || 'Test notification from ShelfGuard background service.',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount Vite or static server
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const http = await import('http');
  const httpServer = http.createServer(app);

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ShelfGuard server running on port ${PORT} [mode: ${isDev ? 'development' : 'production'}]`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
