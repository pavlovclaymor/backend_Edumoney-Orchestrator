/**
 * Observability Layer
 * Sistema de logging, tracing e métricas.
 * Garantir rastreabilidade completa de transações.
 */

import crypto from 'crypto';

// Métricas em memória
const metrics = {
  payments: [],
  ledgerOperations: [],
  workerBacklog: {},
  errors: [],
};

const MAX_METRICS = 1000;

class Observability {
  constructor() {
    this.traces = new Map();
    this.maxTraces = 1000;
  }

  /**
   * Iniciar trace de transação
   */
  startTrace(transactionId, eventType, metadata = {}) {
    const trace = {
      traceId: crypto.randomUUID(),
      transactionId,
      eventType,
      startTime: Date.now(),
      events: [],
      metadata,
      status: 'STARTED',
    };

    this.traces.set(transactionId, trace);
    this.log('INFO', `Trace started: ${transactionId}`, { traceId: trace.traceId, eventType });

    return trace.traceId;
  }

  /**
   * Adicionar evento ao trace
   */
  addEvent(transactionId, eventName, data = {}) {
    const trace = this.traces.get(transactionId);
    if (!trace) return;

    const event = {
      name: eventName,
      timestamp: Date.now(),
      latency: Date.now() - trace.startTime,
      data,
    };

    trace.events.push(event);
    this.log('DEBUG', `Trace event: ${eventName}`, { transactionId, eventName });
  }

  /**
   * Finalizar trace
   */
  endTrace(transactionId, status = 'COMPLETED', error = null) {
    const trace = this.traces.get(transactionId);
    if (!trace) return;

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = status;
    trace.error = error;

    // Limpar traces antigos
    if (this.traces.size > this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      this.traces.delete(oldestKey);
    }

    this.log('INFO', `Trace ended: ${transactionId}`, {
      status,
      duration: trace.duration,
      eventCount: trace.events.length,
    });

    return trace;
  }

  /**
   * Obter trace completo
   */
  getTrace(transactionId) {
    return this.traces.get(transactionId);
  }

  /**
   * Log genérico
   */
  log(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    // Console output formatado
    const prefix =
      {
        INFO: 'ℹ️',
        DEBUG: '🔍',
        WARN: '⚠️',
        ERROR: '❌',
        CRITICAL: '🚨',
      }[level] || '📝';

    console.log(`${prefix} [${entry.timestamp}] ${message}`, context);

    // Armazenar erros
    if (level === 'ERROR' || level === 'CRITICAL') {
      this.recordError(entry);
    }

    return entry;
  }

  /**
   * Record error
   */
  recordError(entry) {
    metrics.errors.push(entry);
    if (metrics.errors.length > MAX_METRICS) {
      metrics.errors.shift();
    }
  }

  /**
   * Registrar métrica de pagamento
   */
  recordPaymentMetric(data) {
    const metric = {
      timestamp: Date.now(),
      latency: data.latency || 0,
      amount: data.amount,
      type: data.type,
      status: data.status,
      userId: data.userId,
    };

    metrics.payments.push(metric);
    if (metrics.payments.length > MAX_METRICS) {
      metrics.payments.shift();
    }

    this.log('INFO', 'Payment metric recorded', metric);
  }

  /**
   * Registrar operação de ledger
   */
  recordLedgerOperation(data) {
    const metric = {
      timestamp: Date.now(),
      latency: data.latency || 0,
      type: data.type,
      amount: data.amount,
      userId: data.userId,
      status: data.status,
    };

    metrics.ledgerOperations.push(metric);
    if (metrics.ledgerOperations.length > MAX_METRICS) {
      metrics.ledgerOperations.shift();
    }
  }

  /**
   * Atualizar backlog de worker
   */
  updateWorkerBacklog(workerName, count) {
    metrics.workerBacklog[workerName] = {
      count,
      lastUpdate: Date.now(),
    };
  }

  /**
   * Obter métricas agregadas
   */
  getMetrics() {
    // Calcular estatísticas de pagamentos
    const paymentStats = this.calculatePaymentStats();
    const ledgerStats = this.calculateLedgerStats();

    return {
      payments: paymentStats,
      ledger: ledgerStats,
      workers: metrics.workerBacklog,
      errors: {
        count: metrics.errors.length,
        recent: metrics.errors.slice(-10),
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  calculatePaymentStats() {
    const recent = metrics.payments.slice(-100);

    if (recent.length === 0) {
      return { count: 0, avgLatency: 0 };
    }

    const totalLatency = recent.reduce((sum, m) => sum + (m.latency || 0), 0);
    const successCount = recent.filter((m) => m.status === 'success').length;

    return {
      count: recent.length,
      avgLatency: Math.round(totalLatency / recent.length),
      successRate: Math.round((successCount / recent.length) * 100),
      totalAmount: recent.reduce((sum, m) => sum + (m.amount || 0), 0),
    };
  }

  calculateLedgerStats() {
    const recent = metrics.ledgerOperations.slice(-100);

    if (recent.length === 0) {
      return { count: 0, avgLatency: 0 };
    }

    const totalLatency = recent.reduce((sum, m) => sum + (m.latency || 0), 0);

    return {
      count: recent.length,
      avgLatency: Math.round(totalLatency / recent.length),
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      activeTraces: this.traces.size,
      metricsCount: {
        payments: metrics.payments.length,
        ledger: metrics.ledgerOperations.length,
        errors: metrics.errors.length,
      },
    };
  }

  /**
   * Limpar métricas antigas
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    metrics.payments = metrics.payments.filter((m) => now - m.timestamp < maxAge);
    metrics.ledgerOperations = metrics.ledgerOperations.filter((m) => now - m.timestamp < maxAge);
    metrics.errors = metrics.errors.filter((e) => now - new Date(e.timestamp).getTime() < maxAge);

    this.log('INFO', 'Metrics cleanup completed');
  }
}

// Singleton
export const observability = new Observability();
export default observability;
