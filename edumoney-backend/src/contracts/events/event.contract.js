/**
 * Event Contract Validation Layer
 * Garante que eventos Redis seguem schema específico.
 * NUNCA publicar evento sem validar schema.
 */

export const EVENT_VERSION = 'v1';

/**
 * Base Event Schema
 */
const BASE_EVENT_SCHEMA = {
  eventId: { type: 'string', required: true },
  eventType: { type: 'string', required: true },
  version: { type: 'string', const: EVENT_VERSION },
  timestamp: { type: 'string', format: 'date-time', required: true },
  correlationId: { type: 'string', required: true },
};

/**
 * Wallet Event Schemas
 */
export const WALLET_CREDITED_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      userId: { type: 'string', required: true },
      amount: { type: 'number', required: true, minimum: 0 },
      balanceAfter: { type: 'number', required: true, minimum: 0 },
      type: { type: 'string', required: true },
      transactionId: { type: 'string' },
    },
    required: ['userId', 'amount', 'balanceAfter'],
  },
};

export const WALLET_DEBITED_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      userId: { type: 'string', required: true },
      amount: { type: 'number', required: true, minimum: 0 },
      balanceAfter: { type: 'number', required: true, minimum: 0 },
      type: { type: 'string', required: true },
      transactionId: { type: 'string' },
    },
    required: ['userId', 'amount', 'balanceAfter'],
  },
};

export const WALLET_FROZEN_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      userId: { type: 'string', required: true },
      reason: { type: 'string', required: true },
      frozenAt: { type: 'string', format: 'date-time' },
    },
    required: ['userId', 'reason'],
  },
};

/**
 * Payment Event Schemas
 */
export const PAYMENT_STARTED_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      userId: { type: 'string', required: true },
      merchantId: { type: 'string' },
      amount: { type: 'number', required: true, minimum: 0 },
      type: { type: 'string', required: true },
      invoiceId: { type: 'string' },
      rupeReference: { type: 'string' },
    },
    required: ['userId', 'amount', 'type'],
  },
};

export const PAYMENT_COMPLETED_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      transactionId: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      merchantId: { type: 'string' },
      amount: { type: 'number', required: true, minimum: 0 },
      type: { type: 'string', required: true },
    },
    required: ['transactionId', 'userId', 'amount'],
  },
};

export const PAYMENT_FAILED_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      userId: { type: 'string', required: true },
      error: { type: 'string', required: true },
      transactionId: { type: 'string' },
    },
    required: ['userId', 'error'],
  },
};

/**
 * Ledger Event Schemas
 */
export const LEDGER_ENTRY_CREATED_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      userId: { type: 'string', required: true },
      type: { type: 'string', enum: ['credit', 'debit'], required: true },
      amount: { type: 'number', required: true, minimum: 0 },
      balanceAfter: { type: 'number', required: true, minimum: 0 },
      transactionId: { type: 'string' },
    },
    required: ['userId', 'type', 'amount', 'balanceAfter'],
  },
};

/**
 * Invoice Event Schemas
 */
export const INVOICE_PAID_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      invoiceId: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      merchantId: { type: 'string', required: true },
      amount: { type: 'number', required: true, minimum: 0 },
    },
    required: ['invoiceId', 'userId', 'merchantId', 'amount'],
  },
};

export const INVOICE_PDF_READY_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      invoiceId: { type: 'string', required: true },
      pdfUrl: { type: 'string', required: true },
    },
    required: ['invoiceId', 'pdfUrl'],
  },
};

/**
 * Recharge Event Schemas
 */
export const RECHARGE_COMPLETED_SCHEMA = {
  ...BASE_EVENT_SCHEMA,
  data: {
    type: 'object',
    properties: {
      transactionId: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      amount: { type: 'number', required: true, minimum: 0 },
      rupeReference: { type: 'string' },
    },
    required: ['transactionId', 'userId', 'amount'],
  },
};

/**
 * Schema Registry
 */
export const SCHEMA_REGISTRY = {
  'wallet:credited': WALLET_CREDITED_SCHEMA,
  'wallet:debited': WALLET_DEBITED_SCHEMA,
  'wallet:frozen': WALLET_FROZEN_SCHEMA,
  'payment:started': PAYMENT_STARTED_SCHEMA,
  'payment:completed': PAYMENT_COMPLETED_SCHEMA,
  'payment:failed': PAYMENT_FAILED_SCHEMA,
  'ledger:entry:created': LEDGER_ENTRY_CREATED_SCHEMA,
  'invoice:paid': INVOICE_PAID_SCHEMA,
  'invoice:pdf:ready': INVOICE_PDF_READY_SCHEMA,
  'recharge:completed': RECHARGE_COMPLETED_SCHEMA,
};

/**
 * Validate Event Against Schema
 */
export const validateEvent = (eventType, eventData) => {
  const schema = SCHEMA_REGISTRY[eventType];

  if (!schema) {
    return {
      valid: false,
      error: `Unknown event type: ${eventType}`,
    };
  }

  const errors = [];

  // Validate base fields
  if (!eventData.eventId) errors.push('eventId is required');
  if (!eventData.eventType) errors.push('eventType is required');
  if (!eventData.timestamp) errors.push('timestamp is required');
  if (!eventData.correlationId) errors.push('correlationId is required');

  // Validate data fields
  const data = eventData.data || {};

  if (schema.data) {
    for (const [field, rules] of Object.entries(schema.data.properties || {})) {
      const value = data[field];

      if (rules.required && (value === undefined || value === null)) {
        errors.push(`data.${field} is required`);
        continue;
      }

      if (value !== undefined) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`data.${field} must be string`);
        }
        if (rules.type === 'number' && typeof value !== 'number') {
          errors.push(`data.${field} must be number`);
        }
        if (rules.minimum !== undefined && value < rules.minimum) {
          errors.push(`data.${field} must be >= ${rules.minimum}`);
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`data.${field} must be one of: ${rules.enum.join(', ')}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    schema: eventType,
    version: EVENT_VERSION,
  };
};

/**
 * Create Validated Event Payload
 */
export const createValidatedEvent = (eventType, data, correlationId) => {
  const eventId = crypto.randomUUID?.() || `evt_${Date.now()}`;

  const eventPayload = {
    eventId,
    eventType,
    version: EVENT_VERSION,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || eventId,
    data,
  };

  // Validate before returning
  const validation = validateEvent(eventType, eventPayload);

  if (!validation.valid) {
    throw new Error(`Event validation failed: ${validation.errors.join(', ')}`);
  }

  return eventPayload;
};

export default {
  EVENT_VERSION,
  SCHEMA_REGISTRY,
  validateEvent,
  createValidatedEvent,
};
