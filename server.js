import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'docs');

// Health check endpoint for Cloud Run / Kubernetes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    app: 'DolaHanta',
    version: '1.0.0'
  });
});

// Deriv API configuration check endpoint
app.get('/api/config', (req, res) => {
  res.status(200).json({
    defaultAppId: process.env.DERIV_APP_ID || '1089',
    mode: 'dual-stream',
    capabilities: ['ticks', 'ticks_history', 'proposal']
  });
});

// Serve compiled static assets
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: '1h',
    etag: true
  }));

  // SPA fallback: return index.html for any unhandled routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.status(503).send('Application is building or dist folder not found. Run npm run build.');
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[DolaHanta] Production server listening on http://0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[DolaHanta] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
