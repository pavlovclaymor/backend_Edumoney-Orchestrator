/**
 * Redis Subscriber
 * Sistema de subscrição de eventos Redis.
 * Workers subscrevem aos canais que precisam processar.
 */

import { redisClient } from './RedisClient.js';
import { CHANNELS } from './RedisPublisher.js';

class RedisSubscriber {
  constructor() {
    this.handlers = new Map();
    this.processedEvents = new Set(); // Para idempotência
    this.maxProcessedCache = 10000;
  }

  /**
   * Registrar handler para canal
   * @param {string} channel - Canal
   * @param {Function} handler - Handler
   */
  async subscribe(channel, handler) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, []);
    }

    this.handlers.get(channel).push(handler);
    await redisClient.subscribe(channel, (message) => this.handleMessage(channel, message));

    console.log(`✅ RedisSubscriber: Registered for ${channel}`);
  }

  /**
   * Registrar múltiplos handlers
   * @param {Object} subscriptions - { channel: handler }
   */
  async subscribeMany(subscriptions) {
    for (const [channel, handler] of Object.entries(subscriptions)) {
      await this.subscribe(channel, handler);
    }
  }

  /**
   * Processar mensagem recebida
   */
  handleMessage(channel, message) {
    try {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;

      // Idempotency check
      if (this.isProcessed(payload.eventId)) {
        console.log(`⏭️ RedisSubscriber: Skipping duplicate ${payload.eventId}`);
        return;
      }

      // Marcar como processado
      this.markProcessed(payload.eventId);

      // Obter handlers
      const handlers = this.handlers.get(channel) || [];

      // Executar handlers
      for (const handler of handlers) {
        try {
          handler(payload, channel);
        } catch (err) {
          console.error(`❌ Handler error for ${channel}:`, err.message);
        }
      }
    } catch (error) {
      console.error(`❌ RedisSubscriber: Message parse error`, error.message);
    }
  }

  /**
   * Verificar se evento já foi processado
   */
  isProcessed(eventId) {
    return this.processedEvents.has(eventId);
  }

  /**
   * Marcar evento como processado
   */
  markProcessed(eventId) {
    this.processedEvents.add(eventId);

    // Limpar cache se necessário
    if (this.processedEvents.size > this.maxProcessedCache) {
      const toDelete = Array.from(this.processedEvents).slice(0, 1000);
      toDelete.forEach((id) => this.processedEvents.delete(id));
    }
  }

  /**
   * Limpar cache de eventos processados
   */
  clearProcessedCache() {
    this.processedEvents.clear();
    console.log('🧹 RedisSubscriber: Processed cache cleared');
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      channels: Array.from(this.handlers.keys()),
      totalHandlers: Array.from(this.handlers.values()).reduce((sum, h) => sum + h.length, 0),
      processedCacheSize: this.processedEvents.size,
    };
  }
}

// Singleton
export const redisSubscriber = new RedisSubscriber();
export default redisSubscriber;
