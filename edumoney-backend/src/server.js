import app from './app.js';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import http from 'http';
import { initSocket } from './services/socket.service.js';

import { startPDFCron } from './utils/pdfCron.js';
import runAdminSeed from './seeds/admin.seed.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

connectDB().then(async () => {
  // iniciar cron job de PDFs
  startPDFCron();
  runAdminSeed();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
