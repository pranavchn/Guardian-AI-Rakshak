/**
 * Smart Rakshak — Cloud Robot Control Center
 * Full-Stack Express Server with Vite Dev Middlewares
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();

  // Support JSON and raw binary body parsing for ESP32-CAM JPEG uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.raw({ type: ['image/*', 'application/octet-stream'], limit: '15mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logger for Cloud Run observability
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/')) {
      const now = new Date().toISOString();
      console.log(`[${now}] ${req.method} ${req.url}`);
    }
    next();
  });

  // REST API routes
  app.use('/api', apiRouter);

  // Catch-all for undefined /api routes so they return JSON 404, NEVER index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Health check endpoint for Cloud Run container probes
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'smart-rakshak-cloud-run',
      project: 'QD00N AI Robot',
      timestamp: new Date().toISOString(),
    });
  });

  // Frontend integration: Vite middleware in development or static dist in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Smart Rakshak] Full-Stack Control Center running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Smart Rakshak] Server startup failed:', err);
  process.exit(1);
});
