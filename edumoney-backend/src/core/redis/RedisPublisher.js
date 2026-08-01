/**
 * Redis Publisher
 * Substitui EventBus em memória por Redis Pub/Sub.
 * Todos os eventos financeiros são publicados no Redis.
 */

import { redisClient } from './RedisClient.js';
import crypto from 'crypto';

// Channels disponíveis
export const CHANNELS = {
  // Wallet events
  WALLET_CREDITED: 'wallet:credited',
  WALLET_DEBITED: 'wallet:debited',
  WALLET_CREATED: 'wallet:created',

  // Transaction events
  TRANSACTION_CREATED: 'transaction:created',
  TRANSACTION_COMPLETED: 'transaction:completed',
  TRANSACTION_FAILED: 'transaction:failed',

  // Payment events
  PAYMENT_STARTED: 'payment:started',
  PAYMENT_COMPLETED: 'payment:completed',
  PAYMENT_FAILED: 'payment:failed',

  // Ledger events
  LEDGER_DEBIT_RESERVED: 'ledger:debit:reserved',
  LEDGER_DEBIT_COMMITTED: 'ledger:debit:committed',
  LEDGER_CREDIT_RESERVED: 'ledger:credit:reserved',
  LEDGER_CREDIT_COMMITTED: 'ledger:credit:committed',

  // Invoice events
  INVOICE_CREATED: 'invoice:created',
  INVOICE_PAID: 'invoice:paid',
  INVOICE_PDF_READY: 'invoice:pdf:ready',

  // Recharge events
  RECHARGE_STARTED: 'recharge:started',
  RECHARGE_COMPLETED: 'recharge:completed',

  // System events
  RECONCILIATION_NEEDED: 'system:reconciliation:needed',
  INCONSISTENCY_DETECTED: 'system:inconsistency:detected',
};

// Event types para correlação
export const EVENT_TYPES = {
  TRANSFER: 'TRANSFER',
  INVOICE_PAYMENT: 'INVOICE_PAYMENT',
  RECHARGE: 'RECHARGE',
  QR_PAYMENT: 'QR_PAYMENT',
  SCHOOL_PAYMENT: 'SCHOOL_PAYMENT',
  CASHOUT: 'CASHOUT',
};

class RedisPublisher {
  constructor() {
    this.eventHistory = [];
    this.maxHistory = 500;
  }

  /**
   * Gerar ID único para evento
   */
  generateEventId() {
    return crypto.randomUUID();
  }

  /**
   * Criar payload de evento padronizado
   */
  createPayload(type, data, correlationId = null) {
    return {
      eventId: this.generateEventId(),
      eventType: type,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || crypto.randomUUID(),
      data,
    };
  }

  /**
   * Publicar evento no Redis
   */
  async publish(channel, payload) {
    const enrichedPayload = {
      ...payload,
      publishedAt: new Date().toISOString(),
    };

    // Adicionar ao histórico local
    this.addToHistory(channel, enrichedPayload);

    // Publicar no Redis
    return await redisClient.publish(channel, enrichedPayload);
  }

  /**
   * Adicionar ao histórico local (para debugging)
   */
  addToHistory(channel, payload) {
    this.eventHistory.push({
      channel,
      payload,
      timestamp: new Date(),
    });

    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
  }

  // ==================== WALLET EVENTS ====================

  async emitWalletCredited(data, correlationId = null) {
    const payload = this.createPayload('WALLET_CREDITED', data, correlationId);
    return await this.publish(CHANNELS.WALLET_CREDITED, payload);
  }

  async emitWalletDebited(data, correlationId = null) {
    const payload = this.createPayload('WALLET_DEBITED', data, correlationId);
    return await this.publish(CHANNELS.WALLET_DEBITED, payload);
  }

  // ==================== TRANSACTION EVENTS ====================

  async emitTransactionCreated(data, correlationId = null) {
    const payload = this.createPayload('TRANSACTION_CREATED', data, correlationId);
    return await this.publish(CHANNELS.TRANSACTION_CREATED, payload);
  }

  async emitTransactionCompleted(data, correlationId = null) {
    const payload = this.createPayload('TRANSACTION_COMPLETED', data, correlationId);
    return await this.publish(CHANNELS.TRANSACTION_COMPLETED, payload);
  }

  async emitTransactionFailed(data, correlationId = null) {
    const payload = this.createPayload('TRANSACTION_FAILED', data, correlationId);
    return await this.publish(CHANNELS.TRANSACTION_FAILED, payload);
  }

  // ==================== PAYMENT EVENTS ====================

  async emitPaymentStarted(data, correlationId = null) {
    const payload = this.createPayload('PAYMENT_STARTED', data, correlationId);
    return await this.publish(CHANNELS.PAYMENT_STARTED, payload);
  }

  async emitPaymentCompleted(data, correlationId = null) {
    const payload = this.createPayload('PAYMENT_COMPLETED', data, correlationId);
    return await this.publish(CHANNELS.PAYMENT_COMPLETED, payload);
  }

  async emitPaymentFailed(data, correlationId = null) {
    const payload = this.createPayload('PAYMENT_FAILED', data, correlationId);
    return await this.publish(CHANNELS.PAYMENT_FAILED, payload);
  }

  // ==================== LEDGER EVENTS ====================

  async emitLedgerDebitReserved(data, correlationId = null) {
    const payload = this.createPayload('LEDGER_DEBIT_RESERVED', data, correlationId);
    return await this.publish(CHANNELS.LEDGER_DEBIT_RESERVED, payload);
  }

  async emitLedgerDebitCommitted(data, correlationId = null) {
    const payload = this.createPayload('LEDGER_DEBIT_COMMITTED', data, correlationId);
    return await this.publish(CHANNELS.LEDGER_DEBIT_COMMITTED, payload);
  }

  async emitLedgerCreditReserved(data, correlationId = null) {
    const payload = this.createPayload('LEDGER_CREDIT_RESERVED', data, correlationId);
    return await this.publish(CHANNELS.LEDGER_CREDIT_RESERVED, payload);
  }

  async emitLedgerCreditCommitted(data, correlationId = null) {
    const payload = this.createPayload('LEDGER_CREDIT_COMMITTED', data, correlationId);
    return await this.publish(CHANNELS.LEDGER_CREDIT_COMMITTED, payload);
  }

  // ==================== INVOICE EVENTS ====================

  async emitInvoiceCreated(data, correlationId = null) {
    const payload = this.createPayload('INVOICE_CREATED', data, correlationId);
    return await this.publish(CHANNELS.INVOICE_CREATED, payload);
  }

  async emitInvoicePaid(data, correlationId = null) {
    const payload = this.createPayload('INVOICE_PAID', data, correlationId);
    return await this.publish(CHANNELS.INVOICE_PAID, payload);
  }

  async emitInvoicePDFReady(data, correlationId = null) {
    const payload = this.createPayload('INVOICE_PDF_READY', data, correlationId);
    return await this.publish(CHANNELS.INVOICE_PDF_READY, payload);
  }

  // ==================== RECHARGE EVENTS ====================

  async emitRechargeStarted(data, correlationId = null) {
    const payload = this.createPayload('RECHARGE_STARTED', data, correlationId);
    return await this.publish(CHANNELS.RECHARGE_STARTED, payload);
  }

  async emitRechargeCompleted(data, correlationId = null) {
    const payload = this.createPayload('RECHARGE_COMPLETED', data, correlationId);
    return await this.publish(CHANNELS.RECHARGE_COMPLETED, payload);
  }

  // ==================== SYSTEM EVENTS ====================

  async emitReconciliationNeeded(data, correlationId = null) {
    const payload = this.createPayload('RECONCILIATION_NEEDED', data, correlationId);
    return await this.publish(CHANNELS.RECONCILIATION_NEEDED, payload);
  }

  async emitInconsistencyDetected(data, correlationId = null) {
    const payload = this.createPayload('INCONSISTENCY_DETECTED', data, correlationId);
    return await this.publish(CHANNELS.INCONSISTENCY_DETECTED, payload);
  }

  /**
   * Obter histórico de eventos
   */
  getHistory(channel = null) {
    if (channel) {
      return this.eventHistory.filter((e) => e.channel === channel);
    }
    return this.eventHistory;
  }

  /**
   * Limpar histórico
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

// Singleton
export const redisPublisher = new RedisPublisher();
export default redisPublisher;
