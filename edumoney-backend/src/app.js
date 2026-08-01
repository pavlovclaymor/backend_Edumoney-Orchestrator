import e from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = e();

// Allowed origins: set FRONTEND_URL in production .env
// Falls back to localhost:5173 (Vite default) for local development
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS bloqueado para a origem: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(e.json());
app.use(morgan('dev'));

// Servir arquivos estáticos (como fotos de perfil)
app.use('/uploads', e.static('uploads'));

app.use('/api', routes);

export default app;
