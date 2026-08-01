/**
 * Admin Service
 * Contém toda a lógica de negócio relacionada a operações administrativas.
 * NÃO deve ter dependências de req/res - apenas lógica pura.
 */

import Wallet from '../models/wallet.js';
import User from '../models/user.model.js';
import Transaction from '../models/transaction.js';
import { antiFraudEngine } from '../core/security/AntiFraudEngine.js';
import { redisPublisher } from '../core/redis/RedisPublisher.js';

/**
 * Obter status da wallet de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Object} Status da wallet
 */
export const getWalletStatus = async (userId) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  const wallet = await Wallet.findOne({ ownerId: userId }).lean();

  if (!wallet) {
    throw Object.assign(new Error('Wallet não encontrada'), { status: 404 });
  }

  const user = await User.findById(userId).select('name email isActive riskScore').lean();

  return {
    walletId: wallet._id,
    userId: wallet.ownerId,
    balance: wallet.balance,
    currency: wallet.currency || 'AOA',
    isFrozen: wallet.isFrozen || false,
    frozenReason: wallet.frozenReason || null,
    frozenAt: wallet.frozenAt || null,
    unfrozenAt: wallet.unfrozenAt || null,
    user: user
      ? {
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          riskScore: user.riskScore || 0,
        }
      : null,
  };
};

/**
 * Congelar wallet de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} adminId - ID do admin que está congelando
 * @param {string} reason - Motivo do congelamento
 * @returns {Object} Wallet congelada
 */
export const freezeWallet = async (userId, adminId, reason) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  if (!reason) {
    throw Object.assign(new Error('Motivo do congelamento é obrigatório'), { status: 400 });
  }

  const wallet = await Wallet.findOne({ ownerId: userId });

  if (!wallet) {
    throw Object.assign(new Error('Wallet não encontrada'), { status: 404 });
  }

  if (wallet.isFrozen) {
    throw Object.assign(new Error('Wallet já está congelada'), { status: 409 });
  }

  wallet.isFrozen = true;
  wallet.frozenReason = reason;
  wallet.frozenAt = new Date();
  wallet.frozenBy = adminId;
  await wallet.save();

  // Publicar evento para Redis
  try {
    await redisPublisher.publish('admin:wallet:frozen', {
      userId,
      adminId,
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Redis publish error:', err);
  }

  return {
    walletId: wallet._id,
    userId: wallet.ownerId,
    isFrozen: true,
    frozenReason: reason,
    frozenAt: wallet.frozenAt,
  };
};

/**
 * Descongelar wallet de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} adminId - ID do admin que está descongelando
 * @returns {Object} Wallet descongelada
 */
export const unfreezeWallet = async (userId, adminId) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  const wallet = await Wallet.findOne({ ownerId: userId });

  if (!wallet) {
    throw Object.assign(new Error('Wallet não encontrada'), { status: 404 });
  }

  if (!wallet.isFrozen) {
    throw Object.assign(new Error('Wallet não está congelada'), { status: 409 });
  }

  wallet.isFrozen = false;
  wallet.frozenReason = null;
  wallet.unfrozenAt = new Date();
  wallet.unfrozenBy = adminId;
  await wallet.save();

  // Publicar evento para Redis
  try {
    await redisPublisher.publish('admin:wallet:unfrozen', {
      userId,
      adminId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Redis publish error:', err);
  }

  return {
    walletId: wallet._id,
    userId: wallet.ownerId,
    isFrozen: false,
    unfrozenAt: wallet.unfrozenAt,
  };
};

/**
 * Obter lista de wallets congeladas
 * @returns {Array} Lista de wallets congeladas
 */
export const getFrozenWallets = async () => {
  const wallets = await Wallet.find({ isFrozen: true })
    .populate('ownerId', 'name email role')
    .lean();

  return wallets.map((w) => ({
    walletId: w._id,
    userId: w.ownerId,
    balance: w.balance,
    frozenReason: w.frozenReason,
    frozenAt: w.frozenAt,
    user: w.ownerId
      ? {
          name: w.ownerId.name,
          email: w.ownerId.email,
          role: w.ownerId.role,
        }
      : null,
  }));
};

/**
 * Suspender usuário
 * @param {string} userId - ID do usuário
 * @param {string} adminId - ID do admin
 * @param {string} reason - Motivo da suspensão
 * @returns {Object} Usuário suspenso
 */
export const suspendUser = async (userId, adminId, reason) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  const user = await User.findById(userId);

  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Usuário já está inativo'), { status: 409 });
  }

  user.isActive = false;
  user.suspendedAt = new Date();
  user.suspendedBy = adminId;
  user.suspensionReason = reason;
  await user.save();

  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    isActive: false,
    suspendedAt: user.suspendedAt,
    suspensionReason: reason,
  };
};

/**
 * Reativar usuário
 * @param {string} userId - ID do usuário
 * @param {string} adminId - ID do admin
 * @returns {Object} Usuário reativado
 */
export const reactivateUser = async (userId, adminId) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  const user = await User.findById(userId);

  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  if (user.isActive) {
    throw Object.assign(new Error('Usuário já está ativo'), { status: 409 });
  }

  user.isActive = true;
  user.reactivatedAt = new Date();
  user.reactivatedBy = adminId;
  await user.save();

  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    isActive: true,
    reactivatedAt: user.reactivatedAt,
  };
};

/**
 * Obter status do usuário
 * @param {string} userId - ID do usuário
 * @returns {Object} Status do usuário
 */
export const getUserStatus = async (userId) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  const user = await User.findById(userId)
    .select('name email role isActive riskScore suspendedAt')
    .lean();

  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    riskScore: user.riskScore || 0,
    suspendedAt: user.suspendedAt || null,
  };
};

/**
 * Definir risk score de usuário
 * @param {string} userId - ID do usuário
 * @param {number} score - Score de risco (0-1)
 * @returns {Object} Usuário com novo score
 */
export const setUserRiskScore = async (userId, score) => {
  if (!userId) {
    throw Object.assign(new Error('ID do usuário é obrigatório'), { status: 400 });
  }

  if (score === undefined || score === null) {
    throw Object.assign(new Error('Score é obrigatório'), { status: 400 });
  }

  if (score < 0 || score > 1) {
    throw Object.assign(new Error('Score deve estar entre 0 e 1'), { status: 400 });
  }

  const user = await User.findById(userId);

  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  user.riskScore = score;
  await user.save();

  return {
    userId: user._id,
    name: user.name,
    riskScore: user.riskScore,
  };
};

/**
 * Obter estatísticas de fraude
 * @returns {Object} Estatísticas de fraude
 */
export const getFraudStats = async () => {
  const [highRiskUsers, totalUsers, frozenWallets] = await Promise.all([
    User.countDocuments({ riskScore: { $gte: 0.7 } }),
    User.countDocuments(),
    Wallet.countDocuments({ isFrozen: true }),
  ]);

  const recentHighRisk = await User.find({ riskScore: { $gte: 0.7 } })
    .select('name email riskScore')
    .sort({ riskScore: -1 })
    .limit(10)
    .lean();

  return {
    totalUsers,
    highRiskUsers,
    highRiskPercentage: totalUsers > 0 ? (highRiskUsers / totalUsers) * 100 : 0,
    frozenWallets,
    recentHighRisk: recentHighRisk.map((u) => ({
      userId: u._id,
      name: u.name,
      email: u.email,
      riskScore: u.riskScore,
    })),
  };
};

/**
 * Obter alertas de fraude
 * @param {number} limit - Limite de alertas
 * @returns {Array} Lista de alertas
 */
export const getFraudAlerts = async (limit = 20) => {
  const alerts = await User.find({
    riskScore: { $gte: 0.5 },
    'auditFlags.lastFlag': { $exists: true },
  })
    .select('name email riskScore auditFlags')
    .sort({ riskScore: -1 })
    .limit(limit)
    .lean();

  return alerts.map((a) => ({
    userId: a._id,
    name: a.name,
    email: a.email,
    riskScore: a.riskScore,
    lastFlag: a.auditFlags?.lastFlag || null,
  }));
};

/**
 * Obter lista de usuários de alto risco
 * @param {number} threshold - Limiar de risco (default 0.7)
 * @returns {Array} Lista de usuários
 */
export const getHighRiskUsers = async (threshold = 0.7) => {
  const users = await User.find({ riskScore: { $gte: threshold } })
    .select('name email role riskScore isActive')
    .sort({ riskScore: -1 })
    .lean();

  return users.map((u) => ({
    userId: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    riskScore: u.riskScore,
    isActive: u.isActive,
  }));
};

/**
 * Obter dashboard de segurança
 * @returns {Object} Dashboard de segurança
 */
export const getSecurityDashboard = async () => {
  const [stats, frozenWallets, recentTransactions] = await Promise.all([
    getFraudStats(),
    Wallet.countDocuments({ isFrozen: true }),
    Transaction.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    ...stats,
    frozenWallets,
    recentTransactions,
    systemStatus: 'operational',
  };
};

/**
 * Obter lista de usuários
 * @param {Object} filters - Filtros opcionais
 * @returns {Array} Lista de usuários
 */
export const getUsers = async (filters = {}) => {
  const query = {};

  if (filters.role) query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.schoolId) query.schoolId = filters.schoolId;

  const users = await User.find(query)
    .select('name email role isActive riskScore createdAt')
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100)
    .lean();

  return users;
};
