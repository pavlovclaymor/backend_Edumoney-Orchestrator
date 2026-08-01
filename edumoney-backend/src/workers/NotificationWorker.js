/**
 * Notification Worker
 * Processa notificações de forma assíncrona.
 * Escuta eventos e envia notificações push/in-app.
 */

import { eventBus, EVENTS } from '../core/events/EventBus.js';

class NotificationWorker {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.initialize();
  }

  initialize() {
    // Registrar listeners para todos os eventos relevantes
    eventBus.on(EVENTS.PAYMENT_COMPLETED, async (data) => {
      await this.handlePaymentCompleted(data);
    });

    eventBus.on(EVENTS.PAYMENT_FAILED, async (data) => {
      await this.handlePaymentFailed(data);
    });

    eventBus.on(EVENTS.RECHARGE_COMPLETED, async (data) => {
      await this.handleRechargeCompleted(data);
    });

    eventBus.on(EVENTS.INVOICE_PAID, async (data) => {
      await this.handleInvoicePaid(data);
    });

    eventBus.on(EVENTS.TRANSACTION_CREATED, async (data) => {
      await this.handleTransactionCreated(data);
    });

    console.log('✅ NotificationWorker initialized');
  }

  async handlePaymentCompleted(data) {
    const { userId, merchantId, amount, type } = data;

    // Notificar estudante
    if (userId) {
      await this.createNotification({
        userId,
        userModel: 'User',
        title: 'Pagamento realizado',
        message: `Pagamento de ${amount} Kz realizado com sucesso`,
        type: 'payment',
        priority: 'medium',
        entityId: data.transactionId,
        entityModel: 'Transaction',
      });
    }

    // Notificar comerciante
    if (merchantId) {
      await this.createNotification({
        userId: merchantId,
        userModel: 'Merchant',
        title: 'Recebimento',
        message: `Recebeu ${amount} Kz de pagamento`,
        type: 'payment',
        priority: 'high',
        entityId: data.transactionId,
        entityModel: 'Transaction',
      });
    }
  }

  async handlePaymentFailed(data) {
    const { userId, error } = data;

    if (userId) {
      await this.createNotification({
        userId,
        userModel: 'User',
        title: 'Pagamento falhou',
        message: error || 'O pagamento não foi processado',
        type: 'payment',
        priority: 'high',
      });
    }
  }

  async handleRechargeCompleted(data) {
    const { userId, amount } = data;

    if (userId) {
      await this.createNotification({
        userId,
        userModel: 'User',
        title: 'Recarga realizada',
        message: `Carteira recarregada com ${amount} Kz`,
        type: 'recharge',
        priority: 'high',
        entityId: data.transactionId,
        entityModel: 'Transaction',
      });
    }
  }

  async handleInvoicePaid(data) {
    const { invoiceId, amount } = data;

    // Notificar que PDF está disponível
    // Este evento será emitido após a geração do PDF
  }

  async handleTransactionCreated(data) {
    // Log para debugging
    console.log(`📱 Notification: Nova transação ${data.transactionId}`);
  }

  async createNotification(data) {
    try {
      // Importar dinamicamente para evitar circular dependency
      const { createNotification } = await import('../controllers/notification.controller.js');

      await createNotification(
        data.userId,
        data.userModel,
        data.title,
        data.message,
        data.type,
        data.priority,
        data.entityId,
        data.entityModel,
      );

      console.log(`✅ Notification sent: ${data.title}`);
    } catch (error) {
      console.error(`❌ Notification failed: ${error.message}`);
    }
  }

  async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const notification = this.queue.shift();
      try {
        await this.createNotification(notification);
      } catch (error) {
        console.error('Notification queue error:', error);
      }
    }

    this.isProcessing = false;
  }
}

// Singleton
export const notificationWorker = new NotificationWorker();
export default notificationWorker;
