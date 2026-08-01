/**
 * Audit Worker
 * Registra auditoria de forma assíncrona.
 * Escuta eventos e grava logs de auditoria.
 */

import { eventBus, EVENTS } from '../core/events/EventBus.js';
import { writeAuditLog } from '../utils/auditLogger.js';

class AuditWorker {
  constructor() {
    this.initialize();
  }

  initialize() {
    // Registrar listeners para eventos que requerem auditoria
    eventBus.on(EVENTS.TRANSACTION_COMPLETED, async (data) => {
      await this.handleTransactionCompleted(data);
    });

    eventBus.on(EVENTS.TRANSACTION_FAILED, async (data) => {
      await this.handleTransactionFailed(data);
    });

    eventBus.on(EVENTS.PAYMENT_COMPLETED, async (data) => {
      await this.handlePaymentCompleted(data);
    });

    eventBus.on(EVENTS.PAYMENT_FAILED, async (data) => {
      await this.handlePaymentFailed(data);
    });

    eventBus.on(EVENTS.INVOICE_PAID, async (data) => {
      await this.handleInvoicePaid(data);
    });

    eventBus.on(EVENTS.RECHARGE_COMPLETED, async (data) => {
      await this.handleRechargeCompleted(data);
    });

    console.log('✅ AuditWorker initialized');
  }

  async handleTransactionCompleted(data) {
    const { type, payload, result, duration } = data;

    try {
      await writeAuditLog({
        userId: payload.userId || payload.senderId,
        userModel: payload.userModel || this.getUserModel(type),
        action: `TRANSACTION_${type}_COMPLETED`,
        entity: 'Transaction',
        entityId: result?.transaction?._id || result?.transactionId,
        status: 'success',
        schoolId: payload.schoolId,
        metadata: {
          type,
          amount: payload.amount,
          duration,
        },
      }).catch(() => {});

      console.log(`📋 AuditWorker: Transaction ${type} completed`);
    } catch (error) {
      console.error('Audit error (transaction completed):', error.message);
    }
  }

  async handleTransactionFailed(data) {
    const { type, payload, error } = data;

    try {
      await writeAuditLog({
        userId: payload.userId || payload.senderId,
        userModel: payload.userModel || this.getUserModel(type),
        action: `TRANSACTION_${type}_FAILED`,
        entity: 'Transaction',
        entityId: null,
        status: 'failed',
        schoolId: payload.schoolId,
        metadata: {
          type,
          amount: payload.amount,
          error,
        },
      }).catch(() => {});

      console.log(`📋 AuditWorker: Transaction ${type} failed`);
    } catch (error) {
      console.error('Audit error (transaction failed):', error.message);
    }
  }

  async handlePaymentCompleted(data) {
    const { userId, merchantId, amount, type } = data;

    try {
      // Auditoria para pagador
      if (userId) {
        await writeAuditLog({
          userId,
          userModel: 'User',
          action: 'PAYMENT_MADE',
          entity: 'Transaction',
          entityId: data.transactionId,
          status: 'success',
          metadata: {
            amount,
            type,
            counterpartyId: merchantId,
          },
        }).catch(() => {});
      }

      // Auditoria para receptor
      if (merchantId) {
        await writeAuditLog({
          userId: merchantId,
          userModel: 'Merchant',
          action: 'PAYMENT_RECEIVED',
          entity: 'Transaction',
          entityId: data.transactionId,
          status: 'success',
          metadata: {
            amount,
            type,
            counterpartyId: userId,
          },
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Audit error (payment completed):', error.message);
    }
  }

  async handlePaymentFailed(data) {
    const { userId, error } = data;

    try {
      await writeAuditLog({
        userId,
        userModel: 'User',
        action: 'PAYMENT_FAILED',
        entity: 'Transaction',
        entityId: data.transactionId,
        status: 'failed',
        metadata: {
          error,
        },
      }).catch(() => {});
    } catch (error) {
      console.error('Audit error (payment failed):', error.message);
    }
  }

  async handleInvoicePaid(data) {
    const { invoiceId, amount } = data;

    try {
      await writeAuditLog({
        userId: data.userId,
        userModel: 'User',
        action: 'INVOICE_PAID',
        entity: 'Invoice',
        entityId: invoiceId,
        status: 'success',
        metadata: {
          amount,
        },
      }).catch(() => {});
    } catch (error) {
      console.error('Audit error (invoice paid):', error.message);
    }
  }

  async handleRechargeCompleted(data) {
    const { userId, amount } = data;

    try {
      await writeAuditLog({
        userId,
        userModel: 'User',
        action: 'RECHARGE_COMPLETED',
        entity: 'Transaction',
        entityId: data.transactionId,
        status: 'success',
        metadata: {
          amount,
          source: 'RUPE',
        },
      }).catch(() => {});
    } catch (error) {
      console.error('Audit error (recharge completed):', error.message);
    }
  }

  getUserModel(type) {
    const modelMap = {
      TRANSFER: 'User',
      INVOICE_PAYMENT: 'User',
      QR_PAYMENT: 'User',
      SCHOOL_PAYMENT: 'User',
      RECHARGE: 'User',
      CASHOUT: 'Merchant',
    };

    return modelMap[type] || 'User';
  }
}

// Singleton
export const auditWorker = new AuditWorker();
export default auditWorker;
