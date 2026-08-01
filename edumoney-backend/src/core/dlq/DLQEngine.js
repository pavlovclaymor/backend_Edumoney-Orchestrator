/**
 * Dead Letter Queue Engine
 * Gerencia eventos falhados com retry e análise.
 */

import { redisStreamClient, STREAMS } from '../streams/RedisStreamClient.js';

class DLQEngine {
  constructor() {
    this.retryConfig = {
      maxRetries: 3,
      backoffMs: [1000, 5000, 15000], // Exponential backoff
      dlqThreshold: 3,
    };
    this.failedEvents = new Map();
  }

  /**
   * Mover evento para DLQ
   * @param {string} stream - Stream original
   * @param {Object} message - Mensagem
   * @param {string} error - Erro
   */
  async moveToDLQ(stream, message, error) {
    const eventId = message.eventId || crypto.randomUUID();

    const dlqEntry = {
      eventId,
      originalStream: stream,
      originalMessageId: message.id,
      eventType: message.eventType,
      timestamp: new Date().toISOString(),
      error,
      errorMessage: error.message || String(error),
      retryCount: (message.retryCount || 0) + 1,
      stack: error.stack || null,
      payload: message.data || message.payload || {},
    };

    // Adicionar ao stream DLQ
    await redisStreamClient.addToStream(STREAMS.DLQ, dlqEntry);

    // Manter histórico local
    this.failedEvents.set(eventId, dlqEntry);

    console.log(`DLQEngine: Moved to DLQ`, { eventId, error: error.message });

    return dlqEntry;
  }

  /**
   * Reprocessar evento do DLQ
   * @param {string} eventId - ID do evento
   * @param {Function} processor - Função para reprocessar
   */
  async reprocessFromDLQ(eventId, processor) {
    const dlqEntry = this.failedEvents.get(eventId);

    if (!dlqEntry) {
      throw new Error(`DLQ entry not found: ${eventId}`);
    }

    if (dlqEntry.retryCount >= this.retryConfig.maxRetries) {
      throw new Error(`Max retries exceeded for ${eventId}`);
    }

    try {
      console.log(`DLQEngine: Reprocessing ${eventId} (attempt ${dlqEntry.retryCount + 1})`);

      await processor(dlqEntry.payload);

      // Sucesso - remover do DLQ
      this.failedEvents.delete(eventId);
      console.log(`DLQEngine: Successfully reprocessed ${eventId}`);

      return { success: true, eventId };
    } catch (error) {
      // Falhou novamente
      dlqEntry.retryCount++;
      dlqEntry.lastError = error.message;
      dlqEntry.lastAttempt = new Date().toISOString();

      console.log(`DLQEngine: Reprocess failed for ${eventId}`, error.message);

      return { success: false, eventId, error: error.message };
    }
  }

  /**
   * Obter métricas do DLQ
   */
  async getMetrics() {
    const metrics = await redisStreamClient.getDLQMetrics();

    return {
      totalFailed: this.failedEvents.size,
      byStream: this.getFailedByStream(),
      byErrorType: this.getFailedByErrorType(),
      redisMetrics: metrics,
    };
  }

  /**
   * Obter falhas por stream
   */
  getFailedByStream() {
    const byStream = new Map();

    for (const entry of this.failedEvents.values()) {
      const stream = entry.originalStream;
      if (!byStream.has(stream)) {
        byStream.set(stream, 0);
      }
      byStream.set(stream, byStream.get(stream) + 1);
    }

    return Object.fromEntries(byStream);
  }

  /**
   * Obter falhas por tipo de erro
   */
  getFailedByErrorType() {
    const byError = new Map();

    for (const entry of this.failedEvents.values()) {
      const errorType = this.categorizeError(entry.error);
      if (!byError.has(errorType)) {
        byError.set(errorType, 0);
      }
      byError.set(errorType, byError.get(errorType) + 1);
    }

    return Object.fromEntries(byError);
  }

  /**
   * Categorizar erro
   */
  categorizeError(error) {
    const errorStr = String(error).toLowerCase();

    if (errorStr.includes('timeout')) return 'TIMEOUT';
    if (errorStr.includes('validation')) return 'VALIDATION';
    if (errorStr.includes('auth')) return 'AUTHENTICATION';
    if (errorStr.includes('balance')) return 'INSUFFICIENT_BALANCE';
    if (errorStr.includes('network')) return 'NETWORK';
    if (errorStr.includes('database') || errorStr.includes('mongo')) return 'DATABASE';

    return 'UNKNOWN';
  }

  /**
   * Listar eventos no DLQ
   */
  listDLQ(limit = 50) {
    const entries = Array.from(this.failedEvents.values());
    return entries.slice(-limit);
  }

  /**
   * Limpar evento do DLQ
   */
  clearFromDLQ(eventId) {
    this.failedEvents.delete(eventId);
    console.log(`DLQEngine: Cleared ${eventId}`);
  }

  /**
   * Limpar todos os eventos do DLQ
   */
  clearAll() {
    this.failedEvents.clear();
    console.log(`DLQEngine: Cleared all entries`);
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      totalFailed: this.failedEvents.size,
      maxRetries: this.retryConfig.maxRetries,
      dlqThreshold: this.retryConfig.dlqThreshold,
    };
  }
}

export const dlqEngine = new DLQEngine();
export default dlqEngine;
