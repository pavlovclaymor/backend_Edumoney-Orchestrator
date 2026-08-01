/**
 * Workers Index
 * Exporta e inicializa todos os workers do sistema.
 */

import { notificationWorker } from './NotificationWorker.js';
import { pdfWorker } from './PDFWorker.js';
import { socketWorker } from './SocketWorker.js';
import { auditWorker } from './AuditWorker.js';
import { ledgerWorker } from './LedgerWorker.js';

/**
 * Inicializar todos os workers
 * Deve ser chamado no startup do servidor
 */
export const initializeWorkers = () => {
  console.log('🚀 Initializing Workers...');

  // Workers já se auto-initializam no import
  // Esta função serve para confirmar e configurar

  return {
    notificationWorker,
    pdfWorker,
    socketWorker,
    auditWorker,
    ledgerWorker,
  };
};

/**
 * Obter worker específico
 */
export const getWorker = (name) => {
  const workers = {
    notification: notificationWorker,
    pdf: pdfWorker,
    socket: socketWorker,
    audit: auditWorker,
    ledger: ledgerWorker,
  };

  return workers[name];
};

export { notificationWorker, pdfWorker, socketWorker, auditWorker, ledgerWorker };
