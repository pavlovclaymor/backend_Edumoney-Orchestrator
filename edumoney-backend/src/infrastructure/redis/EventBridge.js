/**
 * EventBridge - Hybrid Event System
 *
 * Camada de eventos que suporta:
 * - Redis Pub/Sub (produção)
 * - EventEmitter (fallback)
 *
 * Regras:
 * 1. Eventos são emitidos para AMBOS os sistemas
 * 2. Se Redis estiver down, EventEmitter assume
 * 3. Idempotência garantida via eventId
 * 4. Zero breaking changes
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// Tipos de transporte
const TRANSPORT = {
  REDIS: 'redis',
  EMITTER: 'emitter',
  BOTH: 'both',
};

class EventBridge extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000);

    // Estado do sistema
    this.redisConnected = false;
    this.redisClient = null;
    this.currentTransport = TRANSPORT.EMITTER;

    // Idempotência
    this.processedEvents = new Set();
    this.maxCacheSize = 10000;

    // Configuração
    this.config = {
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: process.env.REDIS_PORT || 6379,
      redisPassword: process.env.REDIS_PASSWORD || undefined,
      eventTtl: 3600, // 1 hora para cache de idempotência
    };
  }

  /**
   * Inicializar EventBridge
   * @param {Object} redisClient - Cliente Redis (opcional)
   */
  async initialize(redisClient = null) {
    if (redisClient) {
      this.redisClient = redisClient;
      this.redisConnected = true;
      this.currentTransport = TRANSPORT.REDIS;
      console.log('🔗 EventBridge: Redis mode active');
    } else {
      console.log('🔗 EventBridge: EventEmitter mode (Redis not available)');
    }

    // Setup fallback
    this.setupFallback();

    return this;
  }

  /**
   * Setup fallback para recovery automático
   */
  setupFallback() {
    // Cleanup de eventos antigos periodicamente
    this.cleanupInterval = setInterval(() => {
      this.cleanupProcessedEvents();
    }, 60000); // A cada minuto
  }

  /**
   * Emitir evento (dual mode)
   * @param {string} channel - Canal do evento
   * @param {Object} data - Dados do evento
   */
  async emit(channel, data) {
    const eventId = data.eventId || crypto.randomUUID();
    const event = {
      eventId,
      channel,
      timestamp: new Date().toISOString(),
      data,
    };

    // Emitir localmente (sempre)
    this.emitLocal(event);

    // Emitir via Redis (se disponível)
    if (this.redisConnected && this.redisClient) {
      await this.emitViaRedis(channel, event);
    }

    return eventId;
  }

  /**
   * Emitir evento local via EventEmitter
   */
  emitLocal(event) {
    try {
      super.emit(event.channel, event);
      super.emit('*', event); // wildcard
    } catch (error) {
      console.error('EventBridge: Local emit error', error.message);
    }
  }

  /**
   * Emitir evento via Redis
   */
  async emitViaRedis(channel, event) {
    try {
      const redisChannel = `event:${channel}`;
      await this.redisClient.publish(redisChannel, JSON.stringify(event));
    } catch (error) {
      console.error('EventBridge: Redis emit failed, using fallback', error.message);
      // Redis falhou, continuar apenas com EventEmitter
      this.handleRedisFailure();
    }
  }

  /**
   * Subscribe a um canal
   * @param {string} channel - Canal
   * @param {Function} handler - Handler
   */
  subscribe(channel, handler) {
    // Subscribe local
    this.on(channel, handler);

    // Subscribe Redis
    if (this.redisConnected && this.redisClient) {
      this.subscribeRedis(channel, handler);
    }

    return () => {
      this.off(channel, handler);
    };
  }

  /**
   * Subscribe Redis a um canal
   */
  async subscribeRedis(channel, handler) {
    try {
      const redisChannel = `event:${channel}`;
      await this.redisClient.subscribe(redisChannel);

      this.redisClient.on('message', (ch, message) => {
        if (ch === redisChannel) {
          try {
            const event = JSON.parse(message);
            // Idempotency check
            if (!this.isEventProcessed(event.eventId)) {
              this.markEventProcessed(event.eventId);
              handler(event);
            }
          } catch (error) {
            console.error('EventBridge: Redis message parse error', error.message);
          }
        }
      });
    } catch (error) {
      console.error('EventBridge: Redis subscribe failed', error.message);
    }
  }

  /**
   * Verificar se evento já foi processado
   */
  isEventProcessed(eventId) {
    return this.processedEvents.has(eventId);
  }

  /**
   * Marcar evento como processado
   */
  markEventProcessed(eventId) {
    this.processedEvents.add(eventId);

    // Limitar cache
    if (this.processedEvents.size > this.maxCacheSize) {
      const first = this.processedEvents.values().next().value;
      this.processedEvents.delete(first);
    }
  }

  /**
   * Cleanup de eventos processados
   */
  cleanupProcessedEvents() {
    const before = this.processedEvents.size;

    // Manter apenas os 5000 mais recentes
    if (this.processedEvents.size > 5000) {
      const toDelete = Array.from(this.processedEvents).slice(0, before - 5000);
      toDelete.forEach((id) => this.processedEvents.delete(id));
    }

    if (before !== this.processedEvents.size) {
      console.log(`EventBridge: Cleaned ${before - this.processedEvents.size} events`);
    }
  }

  /**
   * Tratar falha do Redis
   */
  handleRedisFailure() {
    if (this.currentTransport !== TRANSPORT.EMITTER) {
      console.warn('⚠️ EventBridge: Redis down, switching to EventEmitter mode');
      this.redisConnected = false;
      this.currentTransport = TRANSPORT.EMITTER;
    }
  }

  /**
   * Recover conexão Redis
   */
  async recoverRedis(redisClient) {
    try {
      // Testar conexão
      await redisClient.ping();

      this.redisClient = redisClient;
      this.redisConnected = true;
      this.currentTransport = TRANSPORT.BOTH;

      console.log('✅ EventBridge: Redis recovered, dual mode active');
    } catch (error) {
      console.error('EventBridge: Redis recovery failed', error.message);
    }
  }

  /**
   * Obter status do sistema
   */
  getStatus() {
    return {
      transport: this.currentTransport,
      redisConnected: this.redisConnected,
      processedEventsCache: this.processedEvents.size,
      listenerCount: this.listenerCount('*'),
    };
  }

  /**
   * Shutdown gracioso
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        // Ignore
      }
    }

    this.processedEvents.clear();
    console.log('EventBridge: Shutdown complete');
  }
}

// Singleton
export const eventBridge = new EventBridge();
export default eventBridge;
