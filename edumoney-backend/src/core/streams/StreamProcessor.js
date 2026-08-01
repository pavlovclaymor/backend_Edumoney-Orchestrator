/**
 * Stream Processor
 * Gerencia workers consumidores de streams Redis.
 * Implementa retry, DLQ, e idempotency.
 */

import { redisStreamClient, STREAMS, CONSUMER_GROUPS } from './RedisStreamClient.js';
import crypto from 'crypto';

// Idempotency storage (em produção, usar Redis)
const processedEvents = new Set();
const MAX_PROCESSED_CACHE = 10000;

class StreamProcessor {
  constructor() {
    this.processors = new Map();
    this.isRunning = false;
    this.consumerName = crypto.randomUUID();
  }

  /**
   * Registrar processor para stream
   * @param {string} stream - Nome do stream
   * @param {string} group - Consumer group
   * @param {Function} handler - Handler de eventos
   */
  registerProcessor(stream, group, handler) {
    if (!this.processors.has(stream)) {
      this.processors.set(stream, []);
    }

    this.processors.get(stream).push({ group, handler });
    console.log(`✅ StreamProcessor: Registered for ${stream} (${group})`);
  }

  /**
   * Iniciar processamento de todos os streams
   */
  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🚀 StreamProcessor: Starting...');

    // Processar cada stream
    for (const [stream, handlers] of this.processors.entries()) {
      for (const { group, handler } of handlers) {
        this.processStream(stream, group, handler);
      }
    }
  }

  /**
   * Processar stream específico
   */
  async processStream(stream, group, handler) {
    console.log(`📥 StreamProcessor: Processing ${stream} (${group})`);

    while (this.isRunning) {
      try {
        // Ler mensagens do stream
        const messages = await redisStreamClient.readFromStream(
          stream,
          group,
          this.consumerName,
          5,
        );

        for (const message of messages) {
          await this.processMessage(stream, group, message, handler);
        }
      } catch (error) {
        console.error(`❌ StreamProcessor: Error processing ${stream}`, error.message);
        await this.sleep(1000);
      }
    }
  }

  /**
   * Processar mensagem individual
   */
  async processMessage(stream, group, message, handler) {
    const startTime = Date.now();

    try {
      // Idempotency check
      if (this.isProcessed(message.eventId)) {
        console.log(`⏭️ StreamProcessor: Skipping duplicate ${message.eventId}`);
        await redisStreamClient.acknowledge(stream, group, message.id);
        return;
      }

      // Parse payload
      const data = message.data || {};

      console.log(`📥 StreamProcessor: Processing ${message.eventType}`, {
        eventId: message.eventId,
        stream,
      });

      // Executar handler
      await handler(data, message);

      // Marcar como processado
      this.markProcessed(message.eventId);

      // Acknowledgement
      await redisStreamClient.acknowledge(stream, group, message.id);

      console.log(
        `✅ StreamProcessor: Processed ${message.eventType} in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      console.error(`❌ StreamProcessor: Process failed for ${message.eventId}`, error.message);

      // Retry logic
      const retryCount = (message.retryCount || 0) + 1;

      if (retryCount >= 3) {
        // Mover para DLQ
        await redisStreamClient.moveToDLQ(stream, message, error.message);
        await redisStreamClient.acknowledge(stream, group, message.id);
      } else {
        // Nack para retry
        console.log(`🔄 StreamProcessor: Will retry ${message.eventId} (attempt ${retryCount})`);
      }
    }
  }

  /**
   * Verificar se evento já foi processado
   */
  isProcessed(eventId) {
    return processedEvents.has(eventId);
  }

  /**
   * Marcar evento como processado
   */
  markProcessed(eventId) {
    processedEvents.add(eventId);

    // Limpar cache se necessário
    if (processedEvents.size > MAX_PROCESSED_CACHE) {
      const toDelete = Array.from(processedEvents).slice(0, 1000);
      toDelete.forEach((id) => processedEvents.delete(id));
    }
  }

  /**
   * Parar processamento
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 StreamProcessor: Stopped');
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      processors: Array.from(this.processors.keys()),
      consumerName: this.consumerName,
      processedCacheSize: processedEvents.size,
    };
  }
}

// Singleton
export const streamProcessor = new StreamProcessor();
export default streamProcessor;
