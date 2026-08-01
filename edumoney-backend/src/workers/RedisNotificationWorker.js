/**
 * Redis Notification Worker
 * Worker que consome eventos do Redis e envia notificações.
 */

import { redisSubscriber } from '../core/redis/RedisSubscriber.js';
import { CHANNELS } from '../core/redis/RedisPublisher.js';
import { observability } from '../core/observability/Observability.js';

class NotificationWorker {
  constructor() {
    this.processedCount = 0;
  }

  async start() {
    console.log('🚀 Starting Notification Worker...');

    await redisSubscriber.subscribeMany({
      [CHANNELS.PAYMENT_COMPLETED]: this.handlePaymentCompleted.bind(this),
      [CHANNELS.PAYMENT_FAILED]: this.handlePaymentFailed.bind(this),
      [CHANNELS.RECHARGE_COMPLETED]: this.handleRechargeCompleted.bind(this),
      [CHANNELS.INVOICE_PAID]: this.handleInvoicePaid.bind(this),
      [CHANNELS.TRANSACTION_COMPLETED]: this.handleTransactionCompleted.bind(this),
    });

    console.log('✅ Notification Worker: Subscribed to notification channels');
  }

  async handlePaymentCompleted(payload) {
    const { data, eventId } = payload;
    const startTime = Date.now();

    try {
      console.log(`📱 NotificationWorker: Processing payment completed`, { eventId });

      // Notificar estudante
      if (data.userId) {
        await this.sendNotification({
          userId: data.userId,
          userModel: 'User',
          title: 'Pagamento realizado',
          message: `Pagamento de ${data.amount} Kz realizado com sucesso`,
          type: 'payment',
          priority: 'medium',
        });
      }

      // Notificar comerciante
      if (data.merchantId) {
        await this.sendNotification({
          userId: data.merchantId,
          userModel: 'Merchant',
          title: 'Recebimento',
          message: `Recebeu ${data.amount} Kz de pagamento`,
          type: 'payment',
          priority: 'high',
        });
      }

      this.processedCount++;
      observability.log('INFO', 'Notification sent for payment', {
        eventId,
        userId: data.userId,
        latency: Date.now() - startTime,
      });
    } catch (error) {
      observability.log('ERROR', 'Notification failed for payment', {
        eventId,
        error: error.message,
      });
    }
  }

  async handlePaymentFailed(payload) {
    const { data, eventId } = payload;

    try {
      if (data.userId) {
        await this.sendNotification({
          userId: data.userId,
          userModel: 'User',
          title: 'Pagamento falhou',
          message: data.error || 'O pagamento não foi processado',
          type: 'payment',
          priority: 'high',
        });
      }
    } catch (error) {
      observability.log('ERROR', 'Notification failed for payment failure', {
        eventId,
        error: error.message,
      });
    }
  }

  async handleRechargeCompleted(payload) {
    const { data, eventId } = payload;

    try {
      if (data.userId) {
        await this.sendNotification({
          userId: data.userId,
          userModel: 'User',
          title: 'Recarga realizada',
          message: `Carteira recarregada com ${data.amount} Kz`,
          type: 'recharge',
          priority: 'high',
        });
      }
    } catch (error) {
      observability.log('ERROR', 'Notification failed for recharge', {
        eventId,
        error: error.message,
      });
    }
  }

  async handleInvoicePaid(payload) {
    const { data, eventId } = payload;

    try {
      if (data.userId) {
        await this.sendNotification({
          userId: data.userId,
          userModel: 'User',
          title: 'Invoice paga',
          message: `Invoice ${data.invoiceId} foi paga com sucesso`,
          type: 'invoice',
          priority: 'medium',
        });
      }
    } catch (error) {
      observability.log('ERROR', 'Notification failed for invoice', {
        eventId,
        error: error.message,
      });
    }
  }

  async handleTransactionCompleted(payload) {
    const { data, eventId } = payload;

    console.log(`📱 NotificationWorker: Transaction completed`, {
      eventId,
      transactionId: data.transactionId,
    });
  }

  async sendNotification(data) {
    // Simular envio de notificação
    console.log(`📱 NotificationWorker: Sending notification`, {
      userId: data.userId,
      title: data.title,
    });

    // Em produção, integrar com:
    // - Push notification service (Firebase, OneSignal)
    // - Email service (SendGrid, AWS SES)
    // - SMS service (Twilio)

    return true;
  }

  getStats() {
    return {
      worker: 'NotificationWorker',
      processedCount: this.processedCount,
    };
  }
}

export const notificationWorker = new NotificationWorker();
export default notificationWorker;
