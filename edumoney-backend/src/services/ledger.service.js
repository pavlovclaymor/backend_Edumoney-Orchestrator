/**
 * Ledger Service
 * Serviço centralizado para todas as operações de ledger.
 * NUNCA chamar Ledger.create diretamente em controllers/services.
 */

import Ledger from '../models/ledger.model.js';

/**
 * Criar entrada no ledger
 * @param {Object} data - Dados da entrada
 * @param {mongoose.ClientSession} session - Sessão da transação (opcional)
 * @returns {Object} Ledger entry criada
 */
export const createEntry = async (data, session = null) => {
  const { transactionId, userId, type, amount, balanceAfter } = data;

  if (!transactionId || !userId || !type || amount === undefined) {
    throw new Error('Campos obrigatórios: transactionId, userId, type, amount');
  }

  if (!['credit', 'debit'].includes(type)) {
    throw new Error("Type deve ser 'credit' ou 'debit'");
  }

  if (amount <= 0) {
    throw new Error('Amount deve ser maior que 0');
  }

  const options = session ? { session } : {};

  const [entry] = await Ledger.create(
    [
      {
        transactionId,
        userId,
        type,
        amount,
        balanceAfter: balanceAfter || 0,
      },
    ],
    options,
  );

  return entry;
};

/**
 * Criar múltiplas entradas no ledger (para debit + credit simultâneos)
 * @param {Array} entries - Array de entradas
 * @param {mongoose.ClientSession} session - Sessão da transação (opcional)
 * @returns {Array} Ledger entries criadas
 */
export const createEntries = async (entries, session = null) => {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw new Error('Entries deve ser um array não vazio');
  }

  // Validar todas as entradas
  for (const entry of entries) {
    if (!entry.transactionId || !entry.userId || !entry.type || !entry.amount) {
      throw new Error('Cada entrada precisa de: transactionId, userId, type, amount');
    }
    if (!['credit', 'debit'].includes(entry.type)) {
      throw new Error("Type deve ser 'credit' ou 'debit'");
    }
  }

  const options = session ? { session } : {};

  const createdEntries = await Ledger.create(entries, options);

  return createdEntries;
};

/**
 * Obter entradas do ledger por userId
 * @param {string} userId - ID do usuário
 * @param {Object} options - Opções adicionais (limit, skip, dateRange)
 * @returns {Array} Ledger entries
 */
export const getEntriesByUser = async (userId, options = {}) => {
  const { limit = 100, skip = 0, startDate, endDate } = options;

  const query = { userId };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const entries = await Ledger.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

  return entries;
};

/**
 * Obter soma de credits para um usuário
 * @param {string} userId - ID do usuário
 * @returns {number} Soma de credits
 */
export const getTotalCredits = async (userId) => {
  const result = await Ledger.aggregate([
    { $match: { userId, type: 'credit' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  return result[0]?.total || 0;
};

/**
 * Obter soma de debits para um usuário
 * @param {string} userId - ID do usuário
 * @returns {number} Soma de debits
 */
export const getTotalDebits = async (userId) => {
  const result = await Ledger.aggregate([
    { $match: { userId, type: 'debit' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  return result[0]?.total || 0;
};

/**
 * Obter saldo calculado do ledger
 * @param {string} userId - ID do usuário
 * @returns {Object} { totalCredits, totalDebits, calculatedBalance }
 */
export const getCalculatedBalance = async (userId) => {
  const totalCredits = await getTotalCredits(userId);
  const totalDebits = await getTotalDebits(userId);

  return {
    totalCredits,
    totalDebits,
    calculatedBalance: totalCredits - totalDebits,
  };
};

/**
 * Verificar consistência entre ledger e wallet
 * @param {string} userId - ID do usuário
 * @param {number} walletBalance - Saldo real da wallet
 * @returns {Object} { isConsistent, walletBalance, calculatedBalance, difference }
 */
export const checkConsistency = async (userId, walletBalance) => {
  const { totalCredits, totalDebits, calculatedBalance } = await getCalculatedBalance(userId);

  const difference = walletBalance - calculatedBalance;
  const isConsistent = difference === 0;

  return {
    isConsistent,
    walletBalance,
    totalCredits,
    totalDebits,
    calculatedBalance,
    difference,
    status: isConsistent ? 'OK' : 'MISMATCH',
  };
};

/**
 * Verificar todas as inconsistências do sistema
 * @returns {Array} Lista de usuários com inconsistências
 */
export const findAllInconsistencies = async () => {
  const Wallet = (await import('../models/wallet.js')).default;

  // Buscar todas as wallets
  const wallets = await Wallet.find({});

  const inconsistencies = [];

  for (const wallet of wallets) {
    const result = await checkConsistency(wallet.ownerId, wallet.balance);

    if (!result.isConsistent) {
      inconsistencies.push({
        walletId: wallet._id,
        ownerId: wallet.ownerId,
        ownerModel: wallet.ownerModel,
        ...result,
      });
    }
  }

  return inconsistencies;
};

export default {
  createEntry,
  createEntries,
  getEntriesByUser,
  getTotalCredits,
  getTotalDebits,
  getCalculatedBalance,
  checkConsistency,
  findAllInconsistencies,
};
