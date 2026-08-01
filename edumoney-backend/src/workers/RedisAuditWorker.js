/**
 * Redis Audit Worker
 * Worker que consome eventos do Redis e grava logs de auditoria.
 */

import { redisSubscriber } from '../core/redis/RedisSubscriber.js';
import { CHANNELS } from '../core/redis/RedisPublisher.js';
import { observability } from '../core/observability/Observability.js';
import { writeAuditLog } from '../utils/auditLogger.js';

class AuditWorker {
  constructor() {
    this.processedCount = 0;
  }

  async start() {
    console.log('🚀 Starting Audit Worker...');

    await redisSubscriber.subscribeMany({
      [CHANNELS.TRANSACTION_COMPLETED]: this.handleTransactionCompleted.bind(this),
      [CHANNELS.TRANSACTION_FAILED]: this.handleTransactionFailed.bind(this),
      [CHANNELS.PAYMENT_COMPLETED]: this.handlePaymentCompleted.bind(this),
      [CHANNELS.PAYMENT_FAILED]: this.handlePaymentFailed.bind(this),
      [CHANNELS.INVOICE_PAID]: this.handleInvoicePaid.bind(this),
      [CHANNELS.RECHARGE_COMPLETED]: this.handleRechargeCompleted.bind(this),
      [CHANNELS.INCONSISTENCY_DETECTED]: this.handleInconsistencyDetected.bind(this),
    });

    console.log('✅ Audit Worker: Subscribed to audit channels');
  }

  async handleTransactionCompleted(payload) {
    const { data, eventId, eventType, timestamp } = payload;

    try {
      console.log(`📋 AuditWorker: Processing transaction completed`, { eventId });

      await writeAuditLog({
        userId: data.userId || data.senderId,
        userModel: this.getUserModel(data.type),
        action: `TRANSACTION_${data.type}_COMPLETED`,
        entity: 'Transaction',
        entityId: data.transactionId,
        status: 'success',
        schoolId: data.schoolId,
        metadata: {
          eventId,
          eventType,
          timestamp,
          amount: data.amount,
          type: data.type,
        },
      }).catch(() => {});

      this.processedCount++;
      observability.log('INFO', 'Audit logged for transaction', { eventId, type: data.type });
    } catch (error) {
      observability.log('ERROR', 'Audit log failed', { eventId, error: error.message });
    }
  }

  async handleTransactionFailed(payload) {
    const { data, eventId, eventType } = payload;

    try {
      await writeAuditLog({
        userId: data.userId || data.senderId,
        userModel: this.getUserModel(data.type),
        action: `TRANSACTION_${data.type}_FAILED`,
        entity: 'Transaction',
        entityId: null,
        status: 'failed',
        metadata: {
          eventId,
          eventType,
          error: data.error,
          amount: data.amount,
        },
      }).catch(() => {});
    } catch (error) {
      observability.log('ERROR', 'Audit log failed for transaction failure', { eventId });
    }
  }

  async handlePaymentCompleted(payload) {
    const { data, eventId } = payload;

    try {
      if (data.userId) {
        await writeAuditLog({
          userId: data.userId,
          userModel: 'User',
          action: 'PAYMENT_MADE',
          entity: 'Transaction',
          entityId: data.transactionId,
          status: 'success',
          metadata: { amount: data.amount, type: data.type },
        }).catch(() => {});
      }

      if (data.merchantId) {
        await writeAuditLog({
          userId: data.merchantId,
          userModel: 'Merchant',
          action: 'PAYMENT_RECEIVED',
          entity: 'Transaction',
          entityId: data.transactionId,
          status: 'success',
          metadata: { amount: data.amount },
        }).catch(() => {});
      }

      this.processedCount++;
    } catch (error) {
      observability.log('ERROR', 'Audit log failed for payment', { eventId });
    }
  }

  async handlePaymentFailed(payload) {
    const { data, eventId } = payload;

    try {
      await writeAuditLog({
        userId: data.userId,
        userModel: 'User',
        action: 'PAYMENT_FAILED',
        entity: 'Transaction',
        entityId: data.transactionId,
        status: 'failed',
        metadata: { error: data.error },
      }).catch(() => {});
    } catch (error) {
      observability.log('ERROR', 'Audit log failed for payment failure', { eventId });
    }
  }

  async handleInvoicePaid(payload) {
    const { data, eventId } = payload;

    try {
      await writeAuditLog({
        userId: data.userId,
        userModel: 'User',
        action: 'INVOICE_PAID',
        entity: 'Invoice',
        entityId: data.invoiceId,
        status: 'success',
        metadata: { amount: data.amount },
      }).catch(() => {});
    } catch (error) {
      observability.log('ERROR', 'Audit log failed for invoice', { eventId });
    }
  }

  async handleRechargeCompleted(payload) {
    const { data, eventId } = payload;

    try {
      await writeAuditLog({
        userId: data.userId,
        userModel: 'User',
        action: 'RECHARGE_COMPLETED',
        entity: 'Transaction',
        entityId: data.transactionId,
        status: 'success',
        metadata: { amount: data.amount, source: 'RUPE' },
      }).catch(() => {});
    } catch (error) {
      observability.log('ERROR', 'Audit log failed for recharge', { eventId });
    }
  }

  async handleInconsistencyDetected(payload) {
    const { data, eventId } = payload;

    try {
      await writeAuditLog({
        userId: data.ownerId,
        userModel: 'System',
        action: 'WALLET_INCONSISTENCY_DETECTED',
        entity: 'Wallet',
        entityId: null,
        status: 'critical',
        metadata: {
          eventId,
          walletBalance: data.walletBalance,
          ledgerBalance: data.ledgerBalance,
          difference: data.difference,
        },
      }).catch(() => {});

      observability.log('CRITICAL', 'Wallet inconsistency detected', {
        eventId,
        ownerId: data.ownerId,
        difference: data.difference,
      });
    } catch (error) {
      observability.log('ERROR', 'Audit log failed for inconsistency', { eventId });
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

  getStats() {
    return {
      worker: 'AuditWorker',
      processedCount: this.processedCount,
    };
  }
}

export const auditWorker = new AuditWorker();
export default auditWorker;
