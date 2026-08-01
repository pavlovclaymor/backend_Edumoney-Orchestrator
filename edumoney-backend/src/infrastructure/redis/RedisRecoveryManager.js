/**
 * Redis Recovery Manager
 *
 * Gerencia recovery automático do Redis.
 * Regras:
 * 1. Reconecta automaticamente em caso de falha
 * 2. Executa replay de eventos pendentes
 * 3. Sincroniza estado com EventBridge
 */

import Redis from 'ioredis';
import { eventBridge } from './EventBridge.js';

const RECOVERY_CONFIG = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

class RedisRecoveryManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.reconnectAttempts = 0;

    // Event queue para replay
    this.pendingEvents = [];
    this.maxPendingEvents = 1000;
  }

  /**
   * Iniciar conexão com recovery
   */
  async connect() {
    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (times > RECOVERY_CONFIG.maxRetries) {
          console.error('Redis: Max retries reached');
          return null; // Para de tentar
        }

        const delay = Math.min(
          RECOVERY_CONFIG.initialDelay * Math.pow(RECOVERY_CONFIG.backoffMultiplier, times),
          RECOVERY_CONFIG.maxDelay,
        );

        console.log(`Redis: Retry ${times}, waiting ${delay}ms`);
        return delay;
      },
    };

    this.redis = new Redis(config);

    this.redis.on('connect', () => {
      console.log('✅ Redis: Connected');
      this.isConnected = true;
      this.retryCount = 0;
      this.onConnected();
    });

    this.redis.on('error', (error) => {
      console.error('Redis: Error', error.message);
      this.isConnected = false;
      this.onDisconnected();
    });

    this.redis.on('close', () => {
      console.warn('Redis: Connection closed');
      this.isConnected = false;
      this.onDisconnected();
    });

    this.redis.on('reconnecting', () => {
      this.retryCount++;
      console.log(`Redis: Reconnecting (attempt ${this.retryCount})`);
    });

    return this.redis;
  }

  /**
   * Callback quando Redis conecta
   */
  async onConnected() {
    console.log('🔄 Redis: Running recovery procedures...');

    // 1. Notificar EventBridge
    await eventBridge.recoverRedis(this.redis);

    // 2. Replay de eventos pendentes
    await this.replayPendingEvents();

    // 3. Health check
    await this.healthCheck();

    console.log('✅ Redis: Recovery complete');
  }

  /**
   * Callback quando Redis desconecta
   */
  onDisconnected() {
    console.warn('⚠️ Redis: Disconnected, EventEmitter mode active');
    this.isConnected = false;
  }

  /**
   * Adicionar evento à queue de replay
   */
  queueEvent(channel, data) {
    if (this.pendingEvents.length >= this.maxPendingEvents) {
      // Remover mais antigo
      this.pendingEvents.shift();
    }

    this.pendingEvents.push({
      channel,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Replay de eventos pendentes
   */
  async replayPendingEvents() {
    if (this.pendingEvents.length === 0) {
      console.log('📭 Redis: No pending events to replay');
      return;
    }

    console.log(`🔄 Redis: Replaying ${this.pendingEvents.length} pending events`);

    const eventsToReplay = [...this.pendingEvents];
    this.pendingEvents = [];

    let successCount = 0;
    let failCount = 0;

    for (const event of eventsToReplay) {
      try {
        await this.redis.publish(`event:${event.channel}`, JSON.stringify(event));
        successCount++;
      } catch (error) {
        failCount++;
        // Readicionar à queue
        this.pendingEvents.push(event);
      }
    }

    console.log(`✅ Redis: Replayed ${successCount} events, ${failCount} failed`);
  }

  /**
   * Health check do Redis
   */
  async healthCheck() {
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') {
        return { healthy: true };
      }
      return { healthy: false, reason: 'Ping failed' };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }

  /**
   * Obter cliente Redis
   */
  getClient() {
    return this.redis;
  }

  /**
   * Verificar se está conectado
   */
  isHealthy() {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Obter status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      retryCount: this.retryCount,
      pendingEvents: this.pendingEvents.length,
      redisClient: this.redis ? 'active' : 'inactive',
    };
  }

  /**
   * Forçar reconnect
   */
  async forceReconnect() {
    if (this.redis) {
      await this.redis.quit();
    }
    return this.connect();
  }

  /**
   * Shutdown gracioso
   */
  async shutdown() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.isConnected = false;
    console.log('RedisRecoveryManager: Shutdown complete');
  }
}

export const redisRecoveryManager = new RedisRecoveryManager();
export default redisRecoveryManager;
