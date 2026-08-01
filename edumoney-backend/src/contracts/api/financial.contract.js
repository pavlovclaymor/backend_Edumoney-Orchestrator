/**
 * Financial API Contract v1
 * Contrato de API para garantir consistência entre backend e frontend.
 * NUNCA alterar este contrato sem versionamento.
 */

export const FINANCIAL_API_VERSION = 'v1';

/**
 * Wallet Response Contract
 * Estrutura que o frontend espera receber
 */
export const WALLET_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    ownerId: { type: 'string' },
    ownerModel: { type: 'string' },
    balance: { type: 'number' },
    currency: { type: 'string', enum: ['AOA'] },
    status: { type: 'string', enum: ['active', 'frozen', 'inactive'] },
    isFrozen: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'ownerId', 'balance', 'currency', 'status', 'updatedAt'],
};

/**
 * Transaction Response Contract
 */
export const TRANSACTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    senderId: { type: 'string' },
    senderType: { type: 'string' },
    receiverId: { type: 'string' },
    receiverType: { type: 'string' },
    amount: { type: 'number' },
    type: {
      type: 'string',
      enum: ['transfer', 'payment', 'recharge', 'cashout', 'refund'],
    },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'success', 'failed', 'reversed'],
    },
    description: { type: 'string' },
    externalReference: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'senderId', 'receiverId', 'amount', 'type', 'status', 'createdAt'],
};

/**
 * Payment Response Contract
 */
export const PAYMENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    transactionId: { type: 'string' },
    invoiceId: { type: 'string' },
    amount: { type: 'number' },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'completed', 'failed'],
    },
    paymentMethod: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'transactionId', 'amount', 'status', 'createdAt'],
};

/**
 * Recharge Response Contract
 */
export const RECHARGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    amount: { type: 'number' },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'success', 'failed'],
    },
    rupeReference: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'userId', 'amount', 'status', 'createdAt'],
};

/**
 * Invoice Response Contract
 */
export const INVOICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    invoiceNumber: { type: 'string' },
    merchantId: { type: 'string' },
    merchantName: { type: 'string' },
    totalAmount: { type: 'number' },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'paid', 'cancelled'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          totalPrice: { type: 'number' },
        },
      },
    },
    createdAt: { type: 'string', format: 'date-time' },
    paidAt: { type: 'string', format: 'date-time' },
    pdfUrl: { type: 'string' },
  },
  required: ['id', 'invoiceNumber', 'merchantId', 'totalAmount', 'status', 'createdAt'],
};

/**
 * Ledger Entry Response Contract
 */
export const LEDGER_ENTRY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    transactionId: { type: 'string' },
    userId: { type: 'string' },
    type: { type: 'string', enum: ['credit', 'debit'] },
    amount: { type: 'number' },
    balanceAfter: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'userId', 'type', 'amount', 'balanceAfter', 'createdAt'],
};

/**
 * Error Response Contract
 */
export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', const: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        field: { type: 'string' },
      },
      required: ['code', 'message'],
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['success', 'error', 'timestamp'],
};

/**
 * Success Response Wrapper
 */
export const wrapSuccessResponse = (data, meta = {}) => ({
  success: true,
  version: FINANCIAL_API_VERSION,
  timestamp: new Date().toISOString(),
  data,
  meta,
});

/**
 * Error Response Wrapper
 */
export const wrapErrorResponse = (code, message, field = null) => ({
  success: false,
  version: FINANCIAL_API_VERSION,
  timestamp: new Date().toISOString(),
  error: {
    code,
    message,
    ...(field && { field }),
  },
});

// Export all schemas
export default {
  FINANCIAL_API_VERSION,
  WALLET_RESPONSE_SCHEMA,
  TRANSACTION_RESPONSE_SCHEMA,
  PAYMENT_RESPONSE_SCHEMA,
  RECHARGE_RESPONSE_SCHEMA,
  INVOICE_RESPONSE_SCHEMA,
  LEDGER_ENTRY_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  wrapSuccessResponse,
  wrapErrorResponse,
};
