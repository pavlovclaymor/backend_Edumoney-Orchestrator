/**
 * System Service
 * Contém toda a lógica de negócio relacionada a monitoramento do sistema.
 * NÃO deve ter dependências de req/res - apenas lógica pura.
 */

import mongoose from 'mongoose';
import { redisClient } from '../core/redis/RedisClient.js';
import { redisPublisher } from '../core/redis/RedisPublisher.js';
import AuditLog from '../models/auditLog.model.js';
import Transaction from '../models/transaction.js';
import User from '../models/user.model.js';
import Wallet from '../models/wallet.js';

// Process uptime tracking
const startTime = Date.now();

/**
 * Obter health check do sistema
 * @returns {Object} Status de saúde do sistema
 */
export const getHealth = async () => {
  const dbStatus = { status: 'unknown', latency: 0 };

  // Check database
  const dbStart = Date.now();
  try {
    const state = mongoose.connection.readyState;
    dbStatus.status = state === 1 ? 'up' : 'down';
    dbStatus.latency = Date.now() - dbStart;
  } catch (e) {
    dbStatus.status = 'down';
    dbStatus.latency = Date.now() - dbStart;
  }

  // Check Redis
  let redisStatus = { status: 'unknown', latency: 0, connected: false };
  const redisStart = Date.now();
  try {
    if (redisClient?.isConnected) {
      await redisClient.ping();
      redisStatus = {
        status: 'up',
        latency: Date.now() - redisStart,
        connected: true,
      };
    } else {
      redisStatus.status = 'down';
    }
  } catch (e) {
    redisStatus.status = 'down';
    redisStatus.latency = Date.now() - redisStart;
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    rss: Math.round(memUsage.rss / 1024 / 1024),
  };

  // Uptime
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const uptimeFormatted = {
    seconds: uptime,
    minutes: Math.floor(uptime / 60),
    hours: Math.floor(uptime / 3600),
    days: Math.floor(uptime / 86400),
  };

  // Overall status
  const isHealthy = dbStatus.status === 'up' && redisStatus.status === 'up';

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    database: dbStatus,
    redis: redisStatus,
    memory,
    version: process.version,
  };
};

/**
 * Obter status do Redis
 * @returns {Object} Status do Redis
 */
export const getRedisStatus = async () => {
  let connected = false;
  let latency = 0;
  let memory = null;
  let clients = 0;

  try {
    if (redisClient?.isConnected) {
      connected = true;
      const start = Date.now();
      await redisClient.ping();
      latency = Date.now() - start;

      // Get memory info
      try {
        const info = await redisClient.info('memory');
        const match = info.match(/used_memory_human:(\S+)/);
        if (match) {
          memory = match[1];
        }
      } catch (e) {
        // Ignore
      }

      // Get connected clients
      try {
        const clientsInfo = await redisClient.info('clients');
        const match = clientsInfo.match(/connected_clients:(\d+)/);
        if (match) {
          clients = parseInt(match[1], 10);
        }
      } catch (e) {
        // Ignore
      }
    }
  } catch (error) {
    console.error('Redis status error:', error);
  }

  return {
    connected,
    latency,
    memory,
    clients,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Obter estatísticas do sistema
 * @returns {Object} Estatísticas gerais
 */
export const getStats = async () => {
  const [totalUsers, totalTransactions, totalWallets, recentTransactions] = await Promise.all([
    User.countDocuments(),
    Transaction.countDocuments(),
    Wallet.countDocuments(),
    Transaction.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  const totalVolume = await Transaction.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const recentVolume = await Transaction.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  return {
    users: {
      total: totalUsers,
    },
    transactions: {
      total: totalTransactions,
      last24h: recentTransactions,
    },
    wallets: {
      total: totalWallets,
    },
    volume: {
      total: totalVolume[0]?.total || 0,
      last24h: recentVolume[0]?.total || 0,
    },
    timestamp: new Date().toISOString(),
  };
};

/**
 * Obter eventos do sistema
 * @param {Object} options - Opções de filtro
 * @returns {Array} Lista de eventos
 */
export const getEvents = async (options = {}) => {
  const { limit = 50, type, action, startDate, endDate } = options;

  const query = {};

  if (type) query.userModel = type;
  if (action) query.action = { $regex: action, $options: 'i' };
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const events = await AuditLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();

  return events.map((e) => ({
    id: e._id,
    action: e.action,
    userModel: e.userModel,
    entity: e.entity,
    status: e.status,
    timestamp: e.createdAt,
    ip: e.ip,
  }));
};

/**
 * Obter status dos workers
 * @returns {Object} Status dos workers
 */
export const getWorkersStatus = async () => {
  // Simulated worker status - in production, this would check actual worker processes
  const workers = [
    { name: 'socket', status: 'running', uptime: 3600 },
    { name: 'audit', status: 'running', uptime: 3600 },
    { name: 'notification', status: 'running', uptime: 3600 },
    { name: 'ledger', status: 'running', uptime: 3600 },
    { name: 'pdf', status: 'running', uptime: 3600 },
  ];

  const redisWorkers = [
    { name: 'redis-audit', status: 'running' },
    { name: 'redis-ledger', status: 'running' },
    { name: 'redis-notification', status: 'running' },
    { name: 'redis-socket', status: 'running' },
  ];

  return {
    standard: workers,
    redis: redisWorkers,
    total: workers.length + redisWorkers.length,
    allHealthy: [...workers, ...redisWorkers].every((w) => w.status === 'running'),
  };
};
