// backend/services/pdfCron.js
import cron from 'node-cron';
import { generateMissingPDFs } from '../services/invoice.service.js';
/**
 * Cron job que roda a cada 5 minutos (pode ajustar)
 * e tenta gerar PDFs pendentes ou que falharam
 */
export const startPDFCron = () => {
  console.log('Cron de PDFs iniciado...');

  // '*/5 * * * *' = a cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    console.log('Rodando cron para gerar PDFs pendentes...');
    try {
      await generateMissingPDFs();
    } catch (error) {
      console.error('Erro no cron de PDFs:', error);
    }
  });
};
