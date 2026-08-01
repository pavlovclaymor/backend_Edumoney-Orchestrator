/**
 * EventBus Core
 * Sistema de eventos centralizado para arquitetura event-driven.
 * Desacopla side effects e permite escalabilidade horizontal.
 */

import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.eventHistory = [];
    this.maxHistory = 1000;
  }

  /**
   * Emitir evento com logging
   * @param {string} event - Nome do evento
   * @param {Object} data - Dados do evento
   */
  emit(event, data) {
    const eventRecord = {
      event,
      data,
      timestamp: new Date(),
    };

    // Manter histórico para debugging
    this.eventHistory.push(eventRecord);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Log para debugging
    console.log(` EventBus: ${event}`, {
      userId: data?.userId || data?.senderId,
      amount: data?.amount,
      timestamp: eventRecord.timestamp,
    });

    return super.emit(event, data);
  }

  /**
   * Registrar listener com autocleanup
   * @param {string} event - Nome do evento
   * @param {Function} handler - Handler do evento
   */
  on(event, handler) {
    super.on(event, handler);
    console.log(`✅ EventBus: Listener registered for "${event}"`);
    return this;
  }

  /**
   * Obter histórico de eventos
   * @param {string} eventName - Filtrar por nome (opcional)
   * @returns {Array} Histórico de eventos
   */
  getHistory(eventName = null) {
    if (eventName) {
      return this.eventHistory.filter((e) => e.event === eventName);
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

// Singleton instance
export const eventBus = new EventBus();

// Event types
export const EVENTS = {
  // Wallet events
  WALLET_CREDITED: 'wallet.credited',
  WALLET_DEBITED: 'wallet.debited',
  WALLET_CREATED: 'wallet.created',

  // Transaction events
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',

  // Payment events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',

  // Ledger events
  LEDGER_CREATED: 'ledger.created',
  LEDGER_DEBIT_CREATED: 'ledger.debit.created',
  LEDGER_CREDIT_CREATED: 'ledger.credit.created',

  // Invoice events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PDF_READY: 'invoice.pdf_ready',

  // Recharge events
  RECHARGE_INITIATED: 'recharge.initiated',
  RECHARGE_COMPLETED: 'recharge.completed',

  // System events
  RECONCILIATION_NEEDED: 'reconciliation.needed',
  INCONSISTENCY_DETECTED: 'inconsistency.detected',
};

// Helper para emitir eventos de钱包
export const emitWalletCredited = (data) => {
  eventBus.emit(EVENTS.WALLET_CREDITED, data);
};

export const emitWalletDebited = (data) => {
  eventBus.emit(EVENTS.WALLET_DEBITED, data);
};

export const emitTransactionCreated = (data) => {
  eventBus.emit(EVENTS.TRANSACTION_CREATED, data);
};

export const emitPaymentCompleted = (data) => {
  eventBus.emit(EVENTS.PAYMENT_COMPLETED, data);
};

export const emitPaymentFailed = (data) => {
  eventBus.emit(EVENTS.PAYMENT_FAILED, data);
};

export const emitLedgerCreated = (data) => {
  eventBus.emit(EVENTS.LEDGER_CREATED, data);
};

export const emitInvoicePaid = (data) => {
  eventBus.emit(EVENTS.INVOICE_PAID, data);
};

export const emitInvoicePDFReady = (data) => {
  eventBus.emit(EVENTS.INVOICE_PDF_READY, data);
};

export const emitRechargeCompleted = (data) => {
  eventBus.emit(EVENTS.RECHARGE_COMPLETED, data);
};

export default eventBus;
