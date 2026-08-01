/**
 * Redis Ledger Worker
 * Worker que consome eventos do Redis e persiste ledger entries.
 * Ledger é tratado como serviço independente.
 */

import Ledger from '../models/ledger.model.js';
import { redisSubscriber } from '../core/redis/RedisSubscriber.js';
import { CHANNELS } from '../core/redis/RedisPublisher.js';
import { observability } from '../core/observability/Observability.js';

class LedgerWorker {
  constructor() {
    this.processedCount = 0;
  }

  async start() {
    console.log('🚀 Starting Ledger Worker...');

    // Subscrever aos canais de ledger
    await redisSubscriber.subscribeMany({
      [CHANNELS.WALLET_DEBITED]: this.handleDebit.bind(this),
      [CHANNELS.WALLET_CREDITED]: this.handleCredit.bind(this),
      [CHANNELS.TRANSACTION_COMPLETED]: this.handleTransactionCompleted.bind(this),
    });

    console.log('✅ Ledger Worker: Subscribed to ledger channels');
  }

  /**
   * Processar evento de debit
   */
  async handleDebit(payload, channel) {
    const startTime = Date.now();
    const { data, eventId, correlationId } = payload;

    try {
      console.log(`📒 LedgerWorker: Processing debit`, { eventId, userId: data.userId });

      // Criar ledger entry
      const entry = await Ledger.create({
        transactionId: data.transactionId || null,
        userId: data.userId,
        type: 'debit',
        amount: data.amount,
        balanceAfter: data.balanceAfter || 0,
        metadata: {
          eventId,
          correlationId,
          source: data.type || 'wallet_event',
          processedAt: new Date(),
        },
      });

      this.processedCount++;
      const latency = Date.now() - startTime;

      observability.recordLedgerOperation({
        latency,
        type: 'debit',
        amount: data.amount,
        userId: data.userId,
        status: 'success',
      });

      console.log(`✅ LedgerWorker: Debit entry created`, {
        entryId: entry._id,
        userId: data.userId,
        amount: data.amount,
        latency,
      });
    } catch (error) {
      console.error(`❌ LedgerWorker: Debit failed`, { error: error.message, eventId });

      observability.recordLedgerOperation({
        latency: Date.now() - startTime,
        type: 'debit',
        amount: data.amount,
        userId: data.userId,
        status: 'failed',
      });

      observability.log('ERROR', 'Ledger debit entry failed', { eventId, error: error.message });
    }
  }

  /**
   * Processar evento de credit
   */
  async handleCredit(payload, channel) {
    const startTime = Date.now();
    const { data, eventId, correlationId } = payload;

    try {
      console.log(`📒 LedgerWorker: Processing credit`, { eventId, userId: data.userId });

      // Criar ledger entry
      const entry = await Ledger.create({
        transactionId: data.transactionId || null,
        userId: data.userId,
        type: 'credit',
        amount: data.amount,
        balanceAfter: data.balanceAfter || 0,
        metadata: {
          eventId,
          correlationId,
          source: data.type || 'wallet_event',
          processedAt: new Date(),
        },
      });

      this.processedCount++;
      const latency = Date.now() - startTime;

      observability.recordLedgerOperation({
        latency,
        type: 'credit',
        amount: data.amount,
        userId: data.userId,
        status: 'success',
      });

      console.log(`✅ LedgerWorker: Credit entry created`, {
        entryId: entry._id,
        userId: data.userId,
        amount: data.amount,
        latency,
      });
    } catch (error) {
      console.error(`❌ LedgerWorker: Credit failed`, { error: error.message, eventId });

      observability.recordLedgerOperation({
        latency: Date.now() - startTime,
        type: 'credit',
        amount: data.amount,
        userId: data.userId,
        status: 'failed',
      });

      observability.log('ERROR', 'Ledger credit entry failed', { eventId, error: error.message });
    }
  }

  /**
   * Processar transação completada
   */
  async handleTransactionCompleted(payload, channel) {
    const { data, eventId } = payload;

    console.log(`📒 LedgerWorker: Transaction completed event`, {
      eventId,
      transactionId: data.transactionId,
    });

    // Ledger entries já são criadas pelo Orchestrator
    // Este worker serve como backup e auditoria
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      worker: 'LedgerWorker',
      processedCount: this.processedCount,
    };
  }
}

// Singleton
export const ledgerWorker = new LedgerWorker();
export default ledgerWorker;
