/**
 * Anti-Fraud Engine
 * Sistema de proteção contra fraude com:
 * - Velocity checks
 * - Anomaly detection
 * - Wallet freezing
 * - Suspicious pattern detection
 */

import Wallet from '../../models/wallet.js';
import Transaction from '../../models/transaction.js';
import { redisPublisher } from '../redis/RedisPublisher.js';

class AntiFraudEngine {
  constructor() {
    // Configurações de thresholds
    this.config = {
      maxTransactionsPerMinute: 10,
      maxAmountPerMinute: 1000000,
      maxTransactionsPerHour: 100,
      maxFailedAttempts: 3,
      freezeThreshold: 0.85,
      alertThreshold: 0.6,
    };

    // Armazenamento de métricas (em produção, usar Redis)
    this.userMetrics = new Map();
    this.frozenWallets = new Set();
  }

  /**
   * Executar verificação anti-fraude
   * @param {Object} transaction - Dados da transação
   * @returns {Object} Resultado da verificação
   */
  async check(transaction) {
    const startTime = Date.now();

    // 1. Verificar se wallet está congelada
    if (this.isWalletFrozen(transaction.userId)) {
      return {
        allowed: false,
        reason: 'WALLET_FROZEN',
        message: 'Carteira está congelada. Contacte o suporte.',
        fraudScore: 1,
      };
    }

    // 2. Verificar velocidade
    const velocityCheck = this.checkVelocity(transaction.userId);
    if (!velocityCheck.allowed) {
      await this.freezeWalletIfNeeded(transaction.userId);
      return {
        allowed: false,
        reason: 'VELOCITY_EXCEEDED',
        message: 'Limite de transações excedido.',
        fraudScore: 0.9,
        details: velocityCheck,
      };
    }

    // 3. Verificar padrões suspeitos
    const patternCheck = this.checkSuspiciousPatterns(transaction);
    if (patternCheck.shouldBlock) {
      await this.freezeWalletIfNeeded(transaction.userId);
      return {
        allowed: false,
        reason: 'SUSPICIOUS_PATTERN',
        message: 'Transação bloqueada por padrão suspeito.',
        fraudScore: patternCheck.score,
        details: patternCheck,
      };
    }

    // 4. Calcular fraud score
    const fraudScore = await this.calculateFraudScore(transaction);

    // 5. Verificar limites de amount
    const amountCheck = this.checkAmountLimits(transaction);
    if (!amountCheck.allowed) {
      return {
        allowed: false,
        reason: 'AMOUNT_EXCEEDED',
        message: amountCheck.message,
        fraudScore: 0.5,
      };
    }

    // 6. Alertar se score alto
    if (fraudScore > this.config.alertThreshold && fraudScore < this.config.freezeThreshold) {
      await this.alertAdmin(transaction.userId, fraudScore, 'HIGH_FRAUD_SCORE');
    }

    // Atualizar métricas
    this.updateMetrics(transaction.userId, transaction.amount);

    return {
      allowed: true,
      fraudScore,
      velocityStatus: velocityCheck,
      patternStatus: patternCheck,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Verificar velocidade de transações
   */
  checkVelocity(userId) {
    const metrics = this.getUserMetrics(userId);
    const now = Date.now();

    // Verificar último minuto
    const lastMinute = metrics.transactions.filter((t) => now - t.timestamp < 60000);
    const lastMinuteAmount = lastMinute.reduce((sum, t) => sum + t.amount, 0);

    if (lastMinute.length >= this.config.maxTransactionsPerMinute) {
      return {
        allowed: false,
        reason: 'TOO_MANY_TRANSACTIONS_PER_MINUTE',
        count: lastMinute.length,
        limit: this.config.maxTransactionsPerMinute,
      };
    }

    if (lastMinuteAmount > this.config.maxAmountPerMinute) {
      return {
        allowed: false,
        reason: 'AMOUNT_EXCEEDED_PER_MINUTE',
        amount: lastMinuteAmount,
        limit: this.config.maxAmountPerMinute,
      };
    }

    // Verificar última hora
    const lastHour = metrics.transactions.filter((t) => now - t.timestamp < 3600000);

    if (lastHour.length >= this.config.maxTransactionsPerHour) {
      return {
        allowed: false,
        reason: 'TOO_MANY_TRANSACTIONS_PER_HOUR',
        count: lastHour.length,
        limit: this.config.maxTransactionsPerHour,
      };
    }

    return { allowed: true, minuteCount: lastMinute.length, hourCount: lastHour.length };
  }

  /**
   * Verificar padrões suspeitos
   */
  checkSuspiciousPatterns(transaction) {
    const metrics = this.getUserMetrics(transaction.userId);
    const now = Date.now();

    let score = 0;
    const patterns = [];

    // Padrão 1: Muitas falhas recentes
    const recentFailures = metrics.failedAttempts.filter(
      (f) => now - f.timestamp < 300000, // 5 minutos
    );

    if (recentFailures.length >= this.config.maxFailedAttempts) {
      score += 0.4;
      patterns.push('MULTIPLE_RECENT_FAILURES');
    }

    // Padrão 2: Transações de valores round (possível teste)
    if (transaction.amount % 1000 === 0 && transaction.amount >= 10000) {
      score += 0.1;
      patterns.push('ROUND_AMOUNT');
    }

    // Padrão 3: Horário suspeito (se implementado)
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) {
      score += 0.15;
      patterns.push('UNUSUAL_HOUR');
    }

    // Padrão 4: Primeira transação grande
    if (metrics.transactions.length < 3 && transaction.amount > 50000) {
      score += 0.2;
      patterns.push('FIRST_LARGE_TRANSACTION');
    }

    return {
      score,
      shouldBlock: score > this.config.freezeThreshold,
      patterns,
    };
  }

  /**
   * Calcular fraud score
   */
  async calculateFraudScore(transaction) {
    let score = 0;

    // Buscar histórico de transações
    const recentTransactions = await Transaction.find({
      senderId: transaction.userId,
      createdAt: { $gte: new Date(Date.now() - 86400000) }, // 24 horas
    });

    // Fator 1: Volume de transações
    if (recentTransactions.length > 20) score += 0.2;

    // Fator 2: Total transacionado
    const totalAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    if (totalAmount > 500000) score += 0.2;

    // Fator 3: Transações para múltiplos destinatários
    const uniqueReceivers = new Set(recentTransactions.map((t) => t.receiverId?.toString()));
    if (uniqueReceivers.size > 5) score += 0.15;

    // Fator 4: Valor da transação atual vs histórico
    const avgAmount = totalAmount / Math.max(recentTransactions.length, 1);
    if (transaction.amount > avgAmount * 3) score += 0.2;

    // Fator 5: Falhas recentes
    const metrics = this.getUserMetrics(transaction.userId);
    if (metrics.failedAttempts.length > 0) score += 0.15;

    return Math.min(score, 1);
  }

  /**
   * Verificar limites de amount
   */
  checkAmountLimits(transaction) {
    if (transaction.amount > 1000000) {
      return {
        allowed: false,
        message: 'Valor máximo por transação é 1.000.000 Kz',
      };
    }

    if (transaction.amount < 0) {
      return {
        allowed: false,
        message: 'Valor inválido',
      };
    }

    return { allowed: true };
  }

  /**
   * Congelar wallet se necessário
   */
  async freezeWalletIfNeeded(userId) {
    const metrics = this.getUserMetrics(userId);
    const now = Date.now();

    // Verificar se tem mais de 3 falhas em 5 minutos
    const recentFailures = metrics.failedAttempts.filter((f) => now - f.timestamp < 300000);

    if (recentFailures.length >= this.config.maxFailedAttempts) {
      await this.freezeWallet(userId, 'EXCESSIVE_FAILED_ATTEMPTS');
      return true;
    }

    return false;
  }

  /**
   * Congelar wallet
   */
  async freezeWallet(userId, reason) {
    this.frozenWallets.add(userId);

    // Atualizar no banco
    await Wallet.findOneAndUpdate(
      { ownerId: userId },
      { isFrozen: true, frozenReason: reason, frozenAt: new Date() },
    );

    // Emitir evento
    await redisPublisher.publish('wallet:frozen', {
      userId,
      reason,
      frozenAt: new Date().toISOString(),
    });

    console.log(`🚫 AntiFraud: Wallet frozen for ${userId}. Reason: ${reason}`);

    return { frozen: true, reason };
  }

  /**
   * Descongelar wallet
   */
  async unfreezeWallet(userId, authorizedBy) {
    this.frozenWallets.delete(userId);

    await Wallet.findOneAndUpdate(
      { ownerId: userId },
      { isFrozen: false, unfrozenAt: new Date(), unfrozenBy: authorizedBy },
    );

    await redisPublisher.publish('wallet:unfrozen', {
      userId,
      unfrozenBy: authorizedBy,
      unfrozenAt: new Date().toISOString(),
    });

    console.log(`🔓 AntiFraud: Wallet unfrozen for ${userId} by ${authorizedBy}`);

    return { unfrozen: true };
  }

  /**
   * Verificar se wallet está congelada
   */
  isWalletFrozen(userId) {
    return this.frozenWallets.has(userId);
  }

  /**
   * Alertar administrador
   */
  async alertAdmin(userId, fraudScore, alertType) {
    console.log(`🚨 AntiFraud ALERT: ${alertType} for user ${userId}. Score: ${fraudScore}`);

    await redisPublisher.publish('system:fraud_alert', {
      userId,
      fraudScore,
      alertType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Obter métricas do usuário
   */
  getUserMetrics(userId) {
    if (!this.userMetrics.has(userId)) {
      this.userMetrics.set(userId, {
        transactions: [],
        failedAttempts: [],
      });
    }
    return this.userMetrics.get(userId);
  }

  /**
   * Atualizar métricas
   */
  updateMetrics(userId, amount) {
    const metrics = this.getUserMetrics(userId);
    metrics.transactions.push({
      amount,
      timestamp: Date.now(),
    });

    // Limpar métricas antigas
    const oneHourAgo = Date.now() - 3600000;
    metrics.transactions = metrics.transactions.filter((t) => t.timestamp > oneHourAgo);
  }

  /**
   * Registrar tentativa falha
   */
  recordFailedAttempt(userId) {
    const metrics = this.getUserMetrics(userId);
    metrics.failedAttempts.push({
      timestamp: Date.now(),
    });

    // Limpar falhas antigas
    const fiveMinutesAgo = Date.now() - 300000;
    metrics.failedAttempts = metrics.failedAttempts.filter((f) => f.timestamp > fiveMinutesAgo);
  }

  /**
   * Obter status da wallet
   */
  getWalletStatus(userId) {
    return {
      frozen: this.isWalletFrozen(userId),
      metrics: this.getUserMetrics(userId),
    };
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      frozenWallets: this.frozenWallets.size,
      monitoredUsers: this.userMetrics.size,
      config: this.config,
    };
  }
}

export const antiFraudEngine = new AntiFraudEngine();
export default antiFraudEngine;
