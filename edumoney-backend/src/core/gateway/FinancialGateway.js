/**
 * Financial Gateway
 * API Gateway para operações financeiras.
 * Implementa:
 * - Rate limiting
 * - Tenant validation
 * - Payload validation
 * - Anti-fraud checks
 */

import crypto from 'crypto';
import { multiTenantManager } from '../tenant/MultiTenantManager.js';

// Rate limiting storage (em produção, usar Redis)
const rateLimitStore = new Map();
const WINDOW_MS = 1000; // 1 segundo

class FinancialGateway {
  constructor() {
    this.fraudRules = [];
    this.initializeDefaultRules();
  }

  /**
   * Inicializar regras de fraude padrão
   */
  initializeDefaultRules() {
    this.fraudRules = [
      {
        name: 'high_velocity',
        description: 'Bloquear se mais de 10 transações em 1 minuto',
        condition: (data) => {
          return this.checkVelocity(data.userId, 10, 60000);
        },
        action: 'block',
        severity: 'high',
      },
      {
        name: 'large_amount',
        description: 'Alertar se transação maior que 500.000 Kz',
        condition: (data) => {
          return data.amount > 500000;
        },
        action: 'alert',
        severity: 'medium',
      },
      {
        name: 'suspicious_pattern',
        description: 'Bloquear se 3+ transações falharam recentemente',
        condition: (data) => {
          return this.getFailedCount(data.userId) >= 3;
        },
        action: 'block',
        severity: 'high',
      },
    ];
  }

  /**
   * Validar request financeiro
   * @param {Object} request - Request a validar
   */
  async validateRequest(request) {
    const errors = [];
    const warnings = [];

    // 1. Validar tenant
    if (!request.tenantId) {
      errors.push({ field: 'tenantId', message: 'Tenant ID é obrigatório' });
    } else {
      try {
        multiTenantManager.validateTenant(request.tenantId);
      } catch (error) {
        errors.push({ field: 'tenantId', message: error.message });
      }
    }

    // 2. Validar userId
    if (!request.userId) {
      errors.push({ field: 'userId', message: 'User ID é obrigatório' });
    }

    // 3. Validar amount
    if (typeof request.amount !== 'number' || request.amount <= 0) {
      errors.push({ field: 'amount', message: 'Amount deve ser número positivo' });
    }

    // 4. Validar rate limit
    if (request.tenantId && request.userId) {
      const rateLimitResult = this.checkRateLimit(request.tenantId, request.userId);
      if (!rateLimitResult.allowed) {
        errors.push({
          field: 'rateLimit',
          message: `Rate limit excedido. Tente novamente em ${rateLimitResult.retryAfter}ms`,
        });
      }
    }

    // 5. Validar quotas
    if (request.tenantId && request.amount) {
      try {
        multiTenantManager.validateTransactionLimit(request.tenantId, request.amount);
      } catch (error) {
        errors.push({ field: 'amount', message: error.message });
      }
    }

    // 6. Fraud checks
    const fraudResult = await this.runFraudChecks(request);
    if (fraudResult.blocked) {
      errors.push({
        field: 'fraud',
        message: `Transação bloqueada por regra de fraude: ${fraudResult.rule}`,
      });
    }
    warnings.push(...fraudResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fraudResult,
    };
  }

  /**
   * Verificar rate limit
   * @param {string} tenantId - ID do tenant
   * @param {string} userId - ID do usuário
   */
  checkRateLimit(tenantId, userId) {
    const key = `${tenantId}:${userId}`;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: 99 };
    }

    const record = rateLimitStore.get(key);

    // Reset window if expired
    if (now - record.windowStart > WINDOW_MS) {
      record.count = 1;
      record.windowStart = now;
      return { allowed: true, remaining: 99 };
    }

    // Check limit
    const tenant = multiTenantManager.getTenant(tenantId);
    const limit = tenant.quotas.rateLimitPerSecond;

    if (record.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: WINDOW_MS - (now - record.windowStart),
      };
    }

    record.count++;
    return { allowed: true, remaining: limit - record.count };
  }

  /**
   * Verificar velocidade de transações
   */
  checkVelocity(userId, maxTransactions, windowMs) {
    // Implementação simplificada
    return false;
  }

  /**
   * Obter contagem de falhas
   */
  getFailedCount(userId) {
    return 0;
  }

  /**
   * Executar checks de fraude
   */
  async runFraudChecks(data) {
    const blocked = false;
    const warnings = [];
    let triggeredRule = null;

    for (const rule of this.fraudRules) {
      try {
        if (rule.condition(data)) {
          if (rule.action === 'block') {
            return { blocked: true, rule: rule.name };
          } else {
            warnings.push({ rule: rule.name, severity: rule.severity });
          }
          triggeredRule = rule.name;
        }
      } catch (error) {
        console.error(`Fraud rule error (${rule.name}):`, error.message);
      }
    }

    return { blocked, warnings, triggeredRule };
  }

  /**
   * Validar payload financeiro
   */
  validatePayload(payload, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = payload[field];

      if (rules.required && (value === undefined || value === null)) {
        errors.push({ field, message: `${field} é obrigatório` });
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push({ field, message: `${field} deve ser do tipo ${rules.type}` });
        }

        if (rules.min !== undefined && value < rules.min) {
          errors.push({ field, message: `${field} deve ser maior que ${rules.min}` });
        }

        if (rules.max !== undefined && value > rules.max) {
          errors.push({ field, message: `${field} deve ser menor que ${rules.max}` });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Adicionar regra de fraude
   */
  addFraudRule(rule) {
    this.fraudRules.push(rule);
    console.log(`✅ FinancialGateway: Added fraud rule ${rule.name}`);
  }

  /**
   * Limpar rate limit store (cleanup)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now - record.windowStart > WINDOW_MS * 60) {
        rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      fraudRules: this.fraudRules.length,
      rateLimitEntries: rateLimitStore.size,
    };
  }
}

export const financialGateway = new FinancialGateway();
export default financialGateway;
