import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import apiRouter from './routes/api.js';
import { securityHeaders } from './middleware/securityMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
const PORT = process.env.PORT || 5001;

// Middleware
const defaultAllowed = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4173',
  'https://poso-jet.vercel.app',
  'http://prisma-pos.page.gd',
  'https://prisma-pos.page.gd'
];
const envAllowed = (process.env.APP_ORIGINS || process.env.APP_BASE_URL || '').split(',').map(value => value.trim()).filter(Boolean);
const allowedOrigins = [...defaultAllowed, ...envAllowed];

app.use(securityHeaders);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.page.gd') ||
      origin.endsWith('.vercel.app') ||
      origin.includes('infinityfree')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

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
  const status = err.code === 'ER_DUP_ENTRY' ? 409 : (err.status && err.status >= 400 && err.status < 600 ? err.status : 500);
  if (status >= 500) console.error('Request failed:', err.code || err.name);
  res.status(status).json({
    status: 'error',
    code: status,
    message: err.code === 'ER_DUP_ENTRY' ? 'Data tersebut sudah terdaftar. Periksa kembali informasi Anda.' : status === 413 ? 'Ukuran unggahan terlalu besar. Total lampiran maksimal 10 MB.' : status >= 500 ? (err.status === 503 ? err.message : 'Layanan sedang mengalami gangguan. Coba lagi beberapa saat.') : err.message,
    fields: err.fields
  });
});

// Only listen locally, Vercel serverless handles HTTP natively
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test' && !process.env.TEST_MODE) {
  const HOST = process.env.HOST || '127.0.0.1';
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
