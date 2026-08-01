export const SOCKET_EVENTS = {
  CONNECT: 'connection',
  DISCONNECT: 'disconnect',
  REGISTER: 'register',
  NOTIFICATION: 'notification',
  PAYMENT_SUCCESS: 'payment:success',
  PAYMENT_CREATED: 'payment:created',
  PAYMENT_RECEIVED: 'payment:received',
  PAYMENT_FAILED: 'payment:failed',
  PROFILE_UPDATED: 'profile:updated',
  WALLET_UPDATED: 'wallet:updated',
  INVOICE_PAID: 'payment:invoice_paid',
  INVOICE_PDF_READY: 'invoice:pdf_ready',
  MERCHANT_INVOICE_PAID: 'invoice:paid',
  // Audit events (realtime audit trail)
  AUDIT_NEW: 'audit:new',
  AUDIT_GLOBAL: 'audit:global',
};
