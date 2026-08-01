/**
 * Redis Stream Client
 * Substitui Pub/Sub por Redis Streams com persistence e replay.
 * Suporta consumer groups, DLQ, e replay de eventos.
 */

import Redis from 'ioredis';
import crypto from 'crypto';

// Stream names
export const STREAMS = {
  WALLET_EVENTS: 'wallet:events',
  PAYMENT_EVENTS: 'payment:events',
  LEDGER_EVENTS: 'ledger:events',
  INVOICE_EVENTS: 'invoice:events',
  SYSTEM_EVENTS: 'system:events',
  DLQ: 'financial:dlq',
};

// Consumer groups
export const CONSUMER_GROUPS = {
  LEDGER_WORKER: 'ledger-workers',
  NOTIFICATION_WORKER: 'notification-workers',
  PDF_WORKER: 'pdf-workers',
  AUDIT_WORKER: 'audit-workers',
  SOCKET_WORKER: 'socket-workers',
};

class RedisStreamClient {
  constructor() {
    this.producer = null;
    this.consumer = null;
    this.isConnected = false;
    this.streams = new Set();
  }

  /**
   * Conectar ao Redis
   */
  async connect() {
    try {
      const config = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 50, 5000),
      };

      // Producer connection
      this.producer = new Redis(config);

      // Consumer connection (separada)
      this.consumer = new Redis(config);

      await this.producer.ping();
      this.isConnected = true;

      console.log('✅ RedisStream: Connected');

      // Initialize streams
      await this.initializeStreams();

      return true;
    } catch (error) {
      console.error('❌ RedisStream connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Inicializar streams e consumer groups
   */
  async initializeStreams() {
    for (const streamName of Object.values(STREAMS)) {
      try {
        // Criar stream se não existir
        await this.producer.xgroup('CREATE', streamName, '$', 'MKSTREAM').catch(() => {});

        // Criar consumer groups
        for (const group of Object.values(CONSUMER_GROUPS)) {
          await this.producer.xgroup('CREATE', streamName, group, '0', 'MKSTREAM').catch(() => {});
        }

        this.streams.add(streamName);
        console.log(`✅ RedisStream: Initialized ${streamName}`);
      } catch (error) {
        console.log(`⚠️ RedisStream: ${streamName} already exists`);
      }
    }
  }

  /**
   * Adicionar evento ao stream
   * @param {string} stream - Nome do stream
   * @param {Object} data - Dados do evento
   * @param {Object} options - Opções (maxLen, group)
   */
  async addToStream(stream, data, options = {}) {
    if (!this.producer || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    const eventId = crypto.randomUUID();
    const entry = {
      eventId,
      eventType: data.eventType || 'UNKNOWN',
      timestamp: new Date().toISOString(),
      tenantId: data.tenantId || 'default',
      userId: data.userId || null,
      payload: JSON.stringify(data),
    };

    // Adicionar ao stream com limite opcional
    const args = [stream, '*'];

    for (const [key, value] of Object.entries(entry)) {
      args.push(key, String(value));
    }

    if (options.maxLen) {
      args.push('MAXLEN', '~', options.maxLen.toString());
    }

    const messageId = await this.producer.xadd(...args);

    console.log(`📤 RedisStream: Added to ${stream}`, { eventId, messageId });

    return { eventId, messageId };
  }

  /**
   * Ler eventos do stream (consumer)
   * @param {string} stream - Nome do stream
   * @param {string} group - Consumer group
   * @param {string} consumer - Consumer name
   * @param {number} count - Número de eventos
   */
  async readFromStream(stream, group, consumer, count = 10) {
    if (!this.consumer || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      // Ler eventos pendentes primeiro
      let messages = await this.consumer.xreadgroup(
        'GROUP',
        group,
        consumer,
        'COUNT',
        count.toString(),
        'BLOCK',
        '1000',
        'STREAMS',
        stream,
        '>',
      );

      // Se não há eventos pendentes, ler novos
      if (!messages || messages.length === 0) {
        messages = await this.consumer.xreadgroup(
          'GROUP',
          group,
          consumer,
          'COUNT',
          count.toString(),
          'BLOCK',
          '1000',
          'STREAMS',
          stream,
          '0',
        );
      }

      return this.parseStreamMessages(messages);
    } catch (error) {
      console.error(`❌ RedisStream: Read error from ${stream}`, error.message);
      return [];
    }
  }

  /**
   * Confirmar evento processado
   * @param {string} stream - Nome do stream
   * @param {string} group - Consumer group
   * @param {string} messageId - ID da mensagem
   */
  async acknowledge(stream, group, messageId) {
    if (!this.consumer) return false;

    try {
      await this.consumer.xack(stream, group, messageId);
      console.log(`✅ RedisStream: Acknowledged ${messageId} in ${stream}`);
      return true;
    } catch (error) {
      console.error(`❌ RedisStream: Ack failed`, error.message);
      return false;
    }
  }

  /**
   * Mover evento para DLQ
   * @param {string} stream - Stream original
   * @param {Object} message - Mensagem
   * @param {string} error - Erro que causou a falha
   */
  async moveToDLQ(stream, message, error) {
    const dlqEntry = {
      originalStream: stream,
      originalMessageId: message.id,
      eventId: message.eventId,
      eventType: message.eventType,
      timestamp: new Date().toISOString(),
      error: error,
      payload: message.payload,
      retryCount: (message.retryCount || 0) + 1,
    };

    await this.addToStream(STREAMS.DLQ, dlqEntry);
    console.log(`📦 RedisStream: Moved to DLQ`, { eventId: message.eventId, error });
  }

  /**
   * Parsear mensagens do stream
   */
  parseStreamMessages(messages) {
    if (!messages || messages.length === 0) return [];

    const parsed = [];

    for (const [streamName, streamMessages] of messages) {
      for (const [messageId, fields] of streamMessages) {
        const message = { id: messageId, stream: streamName };

        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i];
          const value = fields[i + 1];
          message[key] = value;
        }

        // Parse payload
        if (message.payload) {
          try {
            message.data = JSON.parse(message.payload);
          } catch {
            message.data = {};
          }
        }

        parsed.push(message);
      }
    }

    return parsed;
  }

  /**
   * Obter informações do stream
   */
  async getStreamInfo(stream) {
    if (!this.producer) return null;

    try {
      const info = await this.producer.xinfo('STREAM', stream);
      return {
        length: info[1],
        firstEntry: info[3],
        lastEntry: info[5],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Obter métricas do DLQ
   */
  async getDLQMetrics() {
    if (!this.producer) return null;

    try {
      const info = await this.producer.xinfo('STREAM', STREAMS.DLQ);
      return {
        length: info[1] || 0,
        consumerGroups: await this.producer.xinfo('GROUPS', STREAMS.DLQ),
      };
    } catch (error) {
      return { length: 0, consumerGroups: [] };
    }
  }

  /**
   * Limpar stream
   */
  async clearStream(stream) {
    if (!this.producer) return false;

    try {
      await this.producer.del(stream);
      console.log(`🗑️ RedisStream: Cleared ${stream}`);
      return true;
    } catch (error) {
      console.error(`❌ RedisStream: Clear failed`, error.message);
      return false;
    }
  }

  /**
   * Desconectar
   */
  async disconnect() {
    if (this.producer) await this.producer.quit();
    if (this.consumer) await this.consumer.quit();
    this.isConnected = false;
    console.log('🔌 RedisStream: Disconnected');
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      connected: this.isConnected,
      streams: Array.from(this.streams),
    };
  }
}

// Singleton
export const redisStreamClient = new RedisStreamClient();
export default redisStreamClient;
