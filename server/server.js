import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Mount API routes
app.use('/api', apiRouter);
app.use(apiRouter); // Fallback for Vercel serverless rewrite if /api prefix is stripped

// Root health
app.get('/', (req, res) => {
  res.json({
    app: 'POSO Helpdesk API Server',
    database: 'Aiven for MySQL',
    status: 'ONLINE',
    version: '2.5.0'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 404,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    status: 'error',
    code: 500,
    message: err.message || 'Terjadi kesalahan internal server.'
  });
});

// Only listen locally, Vercel serverless handles HTTP natively
if (!process.env.VERCEL) {
  const HOST = '0.0.0.0';
  const server = app.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(` POSO Backend API Server running on http://${HOST}:${PORT}`);
    console.log(` Local access: http://127.0.0.1:${PORT}/api`);
    console.log(` Database: Aiven for MySQL (SSL Mode: REQUIRED)`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    console.error('Server Fatal Error on listen:', err);
  });
}

export default app;
