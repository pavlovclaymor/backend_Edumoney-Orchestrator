/**
 * Socket Worker
 * Emite eventos via Socket.IO de forma assíncrona.
 * Escuta eventos e distribui para os clientes conectados.
 */

import { eventBus, EVENTS } from '../core/events/EventBus.js';

class SocketWorker {
  constructor() {
    this.io = null;
    this.initialize();
  }

  initialize() {
    // Registrar listeners para todos os eventos
    eventBus.on(EVENTS.WALLET_CREDITED, async (data) => {
      await this.handleWalletCredited(data);
    });

    eventBus.on(EVENTS.WALLET_DEBITED, async (data) => {
      await this.handleWalletDebited(data);
    });

    eventBus.on(EVENTS.PAYMENT_COMPLETED, async (data) => {
      await this.handlePaymentCompleted(data);
    });

    eventBus.on(EVENTS.INVOICE_PAID, async (data) => {
      await this.handleInvoicePaid(data);
    });

    eventBus.on(EVENTS.INVOICE_PDF_READY, async (data) => {
      await this.handleInvoicePDFReady(data);
    });

    eventBus.on(EVENTS.RECHARGE_COMPLETED, async (data) => {
      await this.handleRechargeCompleted(data);
    });

    eventBus.on(EVENTS.TRANSACTION_CREATED, async (data) => {
      await this.handleTransactionCreated(data);
    });

    console.log('✅ SocketWorker initialized');
  }

  /**
   * Configurar IO (chamado do server.js)
   */
  setIO(io) {
    this.io = io;
    console.log('✅ SocketWorker: IO instance set');
  }

  async handleWalletCredited(data) {
    const { userId, amount, balanceAfter } = data;

    if (!this.io || !userId) return;

    try {
      this.io.to(userId.toString()).emit('wallet:credited', {
        amount,
        balanceAfter,
        timestamp: new Date(),
      });

      this.io.to(userId.toString()).emit('wallet:updated');

      console.log(`📡 SocketWorker: wallet:credited → ${userId}`);
    } catch (error) {
      console.error('Socket emit error (wallet:credited):', error.message);
    }
  }

  async handleWalletDebited(data) {
    const { userId, amount, balanceAfter } = data;

    if (!this.io || !userId) return;

    try {
      this.io.to(userId.toString()).emit('wallet:debited', {
        amount,
        balanceAfter,
        timestamp: new Date(),
      });

      this.io.to(userId.toString()).emit('wallet:updated');

      console.log(`📡 SocketWorker: wallet:debited → ${userId}`);
    } catch (error) {
      console.error('Socket emit error (wallet:debited):', error.message);
    }
  }

  async handlePaymentCompleted(data) {
    const { userId, merchantId, transactionId, amount, type } = data;

    if (!this.io) return;

    try {
      // Notificar estudante
      if (userId) {
        this.io.to(userId.toString()).emit('payment:completed', {
          transactionId,
          amount,
          type,
          timestamp: new Date(),
        });
      }

      // Notificar comerciante
      if (merchantId) {
        this.io.to(merchantId.toString()).emit('payment:received', {
          transactionId,
          amount,
          type,
          timestamp: new Date(),
        });
      }

      console.log(`📡 SocketWorker: payment events emitted`);
    } catch (error) {
      console.error('Socket emit error (payment:completed):', error.message);
    }
  }

  async handleInvoicePaid(data) {
    const { invoiceId, amount } = data;

    if (!this.io) return;

    try {
      // Emitir para todos os involved (seria preciso buscar invoice)
      // Por agora, emitimos genericamente
      this.io.emit('invoice:paid', {
        invoiceId,
        amount,
        timestamp: new Date(),
      });

      console.log(`📡 SocketWorker: invoice:paid → ${invoiceId}`);
    } catch (error) {
      console.error('Socket emit error (invoice:paid):', error.message);
    }
  }

  async handleInvoicePDFReady(data) {
    const { invoiceId, pdfUrl } = data;

    if (!this.io) return;

    try {
      this.io.emit('invoice:pdf_ready', {
        invoiceId,
        pdfUrl,
        timestamp: new Date(),
      });

      console.log(`📡 SocketWorker: invoice:pdf_ready → ${invoiceId}`);
    } catch (error) {
      console.error('Socket emit error (invoice:pdf_ready):', error.message);
    }
  }

  async handleRechargeCompleted(data) {
    const { userId, amount } = data;

    if (!this.io || !userId) return;

    try {
      this.io.to(userId.toString()).emit('recharge:completed', {
        amount,
        timestamp: new Date(),
      });

      console.log(`📡 SocketWorker: recharge:completed → ${userId}`);
    } catch (error) {
      console.error('Socket emit error (recharge:completed):', error.message);
    }
  }

  async handleTransactionCreated(data) {
    const { transactionId, type } = data;

    if (!this.io) return;

    try {
      this.io.emit('transaction:created', {
        transactionId,
        type,
        timestamp: new Date(),
      });

      console.log(`📡 SocketWorker: transaction:created → ${transactionId}`);
    } catch (error) {
      console.error('Socket emit error (transaction:created):', error.message);
    }
  }
}

// Singleton
export const socketWorker = new SocketWorker();
export default socketWorker;
