/**
 * Redis Client
 * Cliente Redis para Pub/Sub e caching.
 * Substitui EventBus em memória por Redis Pub/Sub.
 */

import Redis from 'ioredis';
import crypto from 'crypto';

// Redis configuration (pode ser configurado via env)
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

class RedisClient {
  constructor() {
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
    this.subscriptions = new Map();
  }

  /**
   * Conectar ao Redis
   */
  async connect() {
    try {
      // Publisher connection
      this.publisher = new Redis(REDIS_CONFIG);

      // Subscriber connection (separada para não bloquear)
      this.subscriber = new Redis(REDIS_CONFIG);

      // Event handlers
      this.publisher.on('connect', () => {
        console.log('✅ Redis Publisher: Connected');
        this.isConnected = true;
      });

      this.subscriber.on('connect', () => {
        console.log('✅ Redis Subscriber: Connected');
      });

      this.publisher.on('error', (err) => {
        console.error('❌ Redis Publisher Error:', err.message);
      });

      this.subscriber.on('error', (err) => {
        console.error('❌ Redis Subscriber Error:', err.message);
      });

      // Test connection
      await this.publisher.ping();
      console.log('✅ Redis: Connection verified');

      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Publicar mensagem no Redis
   * @param {string} channel - Canal
   * @param {Object} message - Mensagem
   */
  async publish(channel, message) {
    if (!this.publisher || !this.isConnected) {
      console.warn('⚠️ Redis not connected, skipping publish');
      return false;
    }

    try {
      const payload = JSON.stringify({
        ...message,
        publishedAt: new Date().toISOString(),
        messageId: crypto.randomUUID(),
      });

      await this.publisher.publish(channel, payload);
      console.log(`📤 Redis Publish: ${channel}`, { messageId: message.messageId });

      return true;
    } catch (error) {
      console.error(`❌ Redis publish error (${channel}):`, error.message);
      return false;
    }
  }

  /**
   * Inscrever-se em canal
   * @param {string} channel - Canal
   * @param {Function} handler - Handler da mensagem
   */
  async subscribe(channel, handler) {
    if (!this.subscriber) {
      console.error('❌ Redis subscriber not initialized');
      return false;
    }

    try {
      // Adicionar ao mapa de subscriptions
      if (!this.subscriptions.has(channel)) {
        await this.subscriber.subscribe(channel);
        this.subscriptions.set(channel, []);
      }

      this.subscriptions.get(channel).push(handler);
      console.log(
        `✅ Redis Subscribe: ${channel} (${this.subscriptions.get(channel).length} handlers)`,
      );

      return true;
    } catch (error) {
      console.error(`❌ Redis subscribe error (${channel}):`, error.message);
      return false;
    }
  }

  /**
   * Inscrever-se em múltiplos canais
   * @param {Array} channels - Canais
   * @param {Function} handler - Handler global
   */
  async subscribeMany(channels, handler) {
    for (const channel of channels) {
      await this.subscribe(channel, handler);
    }
  }

  /**
   * Processar mensagens recebidas
   */
  startMessageProcessing() {
    if (!this.subscriber) return;

    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });
  }

  handleMessage(channel, message) {
    try {
      const data = JSON.parse(message);
      const handlers = this.subscriptions.get(channel) || [];

      for (const handler of handlers) {
        try {
          handler(data, channel);
        } catch (err) {
          console.error(`❌ Handler error for ${channel}:`, err.message);
        }
      }
    } catch (error) {
      console.error(`❌ Message parse error:`, error.message);
    }
  }

  /**
   * Armazenar idempotency key
   * @param {string} key - Chave
   * @param {Object} value - Valor
   * @param {number} ttl - TTL em segundos
   */
  async setIdempotencyKey(key, value, ttl = 300) {
    if (!this.publisher) return false;

    try {
      const fullKey = `idempotency:${key}`;
      await this.publisher.setex(fullKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('❌ Idempotency set error:', error.message);
      return false;
    }
  }

  /**
   * Verificar idempotency key
   * @param {string} key - Chave
   */
  async checkIdempotencyKey(key) {
    if (!this.publisher) return null;

    try {
      const fullKey = `idempotency:${key}`;
      const data = await this.publisher.get(fullKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Idempotency check error:', error.message);
      return null;
    }
  }

  /**
   * Adicionar ao stream de eventos (para tracing)
   * @param {string} stream - Stream name
   * @param {Object} data - Dados
   */
  async addToStream(stream, data) {
    if (!this.publisher) return false;

    try {
      const messageId = await this.publisher.xadd(stream, '*', {
        data: JSON.stringify(data),
        timestamp: Date.now().toString(),
      });
      return messageId;
    } catch (error) {
      console.error('❌ Stream add error:', error.message);
      return null;
    }
  }

  /**
   * Desconectar
   */
  async disconnect() {
    if (this.publisher) {
      await this.publisher.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    this.isConnected = false;
    console.log('🔌 Redis: Disconnected');
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      channels: Array.from(this.subscriptions.keys()),
    };
  }
}

// Singleton
export const redisClient = new RedisClient();
export default redisClient;
