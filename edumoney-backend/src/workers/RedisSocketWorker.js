/**
 * Redis Socket Worker
 * Worker que consome eventos do Redis e emite via Socket.IO.
 */

import { redisSubscriber } from '../core/redis/RedisSubscriber.js';
import { CHANNELS } from '../core/redis/RedisPublisher.js';
import { observability } from '../core/observability/Observability.js';

class SocketWorker {
  constructor() {
    this.io = null;
    this.processedCount = 0;
  }

  setIO(io) {
    this.io = io;
    console.log('✅ RedisSocketWorker: IO instance set');
  }

  async start() {
    console.log('🚀 Starting Socket Worker...');

    await redisSubscriber.subscribeMany({
      [CHANNELS.WALLET_CREDITED]: this.handleWalletCredited.bind(this),
      [CHANNELS.WALLET_DEBITED]: this.handleWalletDebited.bind(this),
      [CHANNELS.PAYMENT_COMPLETED]: this.handlePaymentCompleted.bind(this),
      [CHANNELS.INVOICE_PAID]: this.handleInvoicePaid.bind(this),
      [CHANNELS.INVOICE_PDF_READY]: this.handleInvoicePDFReady.bind(this),
      [CHANNELS.RECHARGE_COMPLETED]: this.handleRechargeCompleted.bind(this),
      [CHANNELS.TRANSACTION_COMPLETED]: this.handleTransactionCreated.bind(this),
    });

    console.log('✅ Socket Worker: Subscribed to socket channels');
  }

  handleWalletCredited(payload) {
    const { data, eventId } = payload;
    const { userId, amount, balanceAfter } = data;

    if (!this.io || !userId) return;

    try {
      this.io.to(userId.toString()).emit('wallet:credited', {
        amount,
        balanceAfter,
        timestamp: new Date(),
      });

      this.io.to(userId.toString()).emit('wallet:updated');

      this.processedCount++;
      console.log(`📡 SocketWorker: wallet:credited → ${userId}`);
    } catch (error) {
      observability.log('ERROR', 'Socket emit failed for wallet:credited', {
        eventId,
        error: error.message,
      });
    }
  }

  handleWalletDebited(payload) {
    const { data, eventId } = payload;
    const { userId, amount, balanceAfter } = data;

    if (!this.io || !userId) return;

    try {
      this.io.to(userId.toString()).emit('wallet:debited', {
        amount,
        balanceAfter,
        timestamp: new Date(),
      });

      this.io.to(userId.toString()).emit('wallet:updated');

      this.processedCount++;
      console.log(`📡 SocketWorker: wallet:debited → ${userId}`);
    } catch (error) {
      observability.log('ERROR', 'Socket emit failed for wallet:debited', {
        eventId,
        error: error.message,
      });
    }
  }

  handlePaymentCompleted(payload) {
    const { data, eventId } = payload;
    const { userId, merchantId, amount, type } = data;

    if (!this.io) return;

    try {
      if (userId) {
        this.io.to(userId.toString()).emit('payment:completed', {
          amount,
          type,
          timestamp: new Date(),
        });
      }

      if (merchantId) {
        this.io.to(merchantId.toString()).emit('payment:received', {
          amount,
          type,
          timestamp: new Date(),
        });
      }

      this.processedCount++;
      console.log(`📡 SocketWorker: payment events emitted`);
    } catch (error) {
      observability.log('ERROR', 'Socket emit failed for payment', { eventId });
    }
  }

  handleInvoicePaid(payload) {
    const { data, eventId } = payload;

    if (!this.io) return;

    try {
      this.io.emit('invoice:paid', {
        invoiceId: data.invoiceId,
        amount: data.amount,
        timestamp: new Date(),
      });

      this.processedCount++;
      console.log(`📡 SocketWorker: invoice:paid → ${data.invoiceId}`);
    } catch (error) {
      observability.log('ERROR', 'Socket emit failed for invoice:paid', { eventId });
    }
  }

  handleInvoicePDFReady(payload) {
    const { data, eventId } = payload;

    if (!this.io) return;

    try {
      this.io.emit('invoice:pdf_ready', {
        invoiceId: data.invoiceId,
        pdfUrl: data.pdfUrl,
        timestamp: new Date(),
      });

      this.processedCount++;
      console.log(`📡 SocketWorker: invoice:pdf_ready → ${data.invoiceId}`);
    } catch (error) {
      observability.log('ERROR', 'Socket emit failed for invoice:pdf_ready', { eventId });
    }
  }

  handleRechargeCompleted(payload) {
    const { data, eventId } = payload;

    if (!this.io || !data.userId) return;

    try {
      this.io.to(data.userId.toString()).emit('recharge:completed', {
        amount: data.amount,
        timestamp: new Date(),
      });

      this.processedCount++;
      console.log(`📡 SocketWorker: recharge:completed → ${data.userId}`);
    } catch (error) {
      observability.log('ERROR', 'Socket emit failed for recharge', { eventId });
    }
  }

  handleTransactionCreated(payload) {
    const { data, eventId } = payload;

    if (!this.io) return;

    try {
      this.io.emit('transaction:created', {
        transactionId: data.transactionId,
        type: data.type,
        timestamp: new Date(),
      });

      this.processedCount++;
      console.log(`📡 SocketWorker: transaction:created → ${data.transactionId}`);
    } catch (error) {
      observability.log('ERROR', 'Socket emit failed for transaction', { eventId });
    }
  }

  getStats() {
    return {
      worker: 'SocketWorker',
      processedCount: this.processedCount,
      ioConnected: !!this.io,
    };
  }
}

export const socketWorker = new SocketWorker();
export default socketWorker;
