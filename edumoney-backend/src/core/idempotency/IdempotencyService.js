/**
 * Idempotency Service
 * Garante que operações financeiras não sejam duplicadas.
 * Resolve problemas de:
 * - Double payment
 * - Retry duplication
 * - Race conditions
 */

import mongoose from 'mongoose';

// In-memory storage for development (em produção, usar Redis)
const idempotencyStore = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

export class IdempotencyService {
  /**
   * Verificar se a chave já existe
   * @param {string} key - Chave de idempotência
   * @returns {Object|null} Dados existentes ou null
   */
  static async check(key) {
    const entry = idempotencyStore.get(key);

    if (!entry) {
      return null;
    }

    // Verificar TTL
    if (Date.now() > entry.expiresAt) {
      idempotencyStore.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Verificar e lançar erro se já existir
   * @param {string} key - Chave de idempotência
   * @param {Object} data - Dados a armazenar (opcional)
   */
  static async ensureNotExists(key, data = {}) {
    const existing = await this.check(key);

    if (existing) {
      const error = new Error('Operação já realizada (idempotency check failed)');
      error.code = 'DUPLICATE_REQUEST';
      error.existingData = existing;
      throw error;
    }

    return false;
  }

  /**
   * Armazenar chave de idempotência
   * @param {string} key - Chave de idempotência
   * @param {Object} data - Dados a armazenar
   * @param {number} ttl - TTL em milissegundos (opcional)
   */
  static async set(key, data, ttl = DEFAULT_TTL) {
    idempotencyStore.set(key, {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Executar operação com idempotência
   * @param {string} key - Chave de idempotência
   * @param {Function} operation - Função a executar
   * @param {Object} options - Opções
   * @returns {Object} Resultado da operação
   */
  static async executeWithIdempotency(key, operation, options = {}) {
    const { ttl = DEFAULT_TTL } = options;

    // Verificar se já existe
    const existing = await this.check(key);
    if (existing) {
      return {
        success: true,
        idempotent: true,
        data: existing,
        message: 'Operação já realizada anteriormente',
      };
    }

    // Executar operação
    const result = await operation();

    // Armazenar resultado
    await this.set(
      key,
      {
        result,
        executedAt: Date.now(),
      },
      ttl,
    );

    return {
      success: true,
      idempotent: false,
      data: result,
    };
  }

  /**
   * Gerar chave de idempotência
   * @param {string} type - Tipo de operação
   * @param {Object} payload - Payload da operação
   * @returns {string} Chave gerada
   */
  static generateKey(type, payload) {
    const parts = [type];

    if (payload.userId) parts.push(payload.userId);
    if (payload.externalReference) parts.push(payload.externalReference);
    if (payload.rupeReference) parts.push(payload.rupeReference);
    if (payload.invoiceId) parts.push(payload.invoiceId);
    if (payload.amount) parts.push(payload.amount);

    return parts.join(':');
  }

  /**
   * Verificar todas as chaves expiradas
   */
  static cleanup() {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of idempotencyStore.entries()) {
      if (now > entry.expiresAt) {
        idempotencyStore.delete(key);
        count++;
      }
    }

    return { cleaned: count };
  }

  /**
   * Obter estatísticas
   */
  static getStats() {
    return {
      total: idempotencyStore.size,
      keys: Array.from(idempotencyStore.keys()),
    };
  }

  /**
   * Limpar todo o store
   */
  static clear() {
    idempotencyStore.clear();
  }

  /**
   * Verificar se chave existe (sem TTL check)
   */
  static has(key) {
    return idempotencyStore.has(key);
  }

  /**
   * Remover chave específica
   */
  static delete(key) {
    return idempotencyStore.delete(key);
  }
}

export default IdempotencyService;
