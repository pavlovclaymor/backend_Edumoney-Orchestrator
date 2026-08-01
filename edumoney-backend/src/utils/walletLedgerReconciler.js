/**
 * Wallet-Ledger Reconciler
 * Utilitário para validar consistência entre Wallet e Ledger.
 * Garantir que: sum(credits) - sum(debits) = wallet.balance
 */

import Wallet from '../models/wallet.js';
import Ledger from '../models/ledger.model.js';

/**
 * Verificar consistência de uma wallet específica
 * @param {string} walletId - ID da wallet
 * @returns {Object} Resultado da reconciliação
 */
export const check = async (walletId) => {
  const wallet = await Wallet.findById(walletId);

  if (!wallet) {
    return {
      success: false,
      error: 'Wallet não encontrada',
      walletId,
    };
  }

  const { ownerId, ownerModel, balance } = wallet;

  // Buscar soma de credits e debits do ledger
  const creditsResult = await Ledger.aggregate([
    { $match: { userId: ownerId } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  let totalCredits = 0;
  let totalDebits = 0;

  for (const result of creditsResult) {
    if (result._id === 'credit') {
      totalCredits = result.total;
    } else if (result._id === 'debit') {
      totalDebits = result.total;
    }
  }

  const calculatedBalance = totalCredits - totalDebits;
  const difference = balance - calculatedBalance;
  const isConsistent = difference === 0;

  return {
    success: true,
    walletId,
    ownerId,
    ownerModel,
    walletBalance: balance,
    totalCredits,
    totalDebits,
    calculatedBalance,
    difference,
    isConsistent,
    status: isConsistent ? 'OK' : 'MISMATCH',
    timestamp: new Date(),
  };
};

/**
 * Verificar todas as wallets do sistema
 * @returns {Array} Lista de resultados por wallet
 */
export const checkAll = async () => {
  const wallets = await Wallet.find({});

  const results = [];

  for (const wallet of wallets) {
    const result = await check(wallet._id);
    results.push(result);
  }

  return {
    totalWallets: results.length,
    consistentWallets: results.filter((r) => r.isConsistent).length,
    inconsistentWallets: results.filter((r) => !r.isConsistent).length,
    results,
  };
};

/**
 * Verificar apenas inconsistências
 * @returns {Array} Lista de wallets com problemas
 */
export const findInconsistencies = async () => {
  const wallets = await Wallet.find({});

  const inconsistencies = [];

  for (const wallet of wallets) {
    const result = await check(wallet._id);
    if (!result.isConsistent) {
      inconsistencies.push(result);
    }
  }

  return inconsistencies;
};

/**
 * Verificar histórico de ledger de um usuário
 * @param {string} userId - ID do usuário
 * @param {Object} options - Opções (limit, skip)
 * @returns {Array} Entradas do ledger
 */
export const getLedgerHistory = async (userId, options = {}) => {
  const { limit = 100, skip = 0 } = options;

  const entries = await Ledger.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit);

  const summary = await Ledger.aggregate([
    { $match: { userId } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  return {
    entries,
    summary,
    userId,
  };
};

/**
 * Calcular saldo projetado baseado no ledger
 * Útil para debugging e auditoria
 * @param {string} userId - ID do usuário
 * @returns {Object} Saldo projetado
 */
export const calculateProjectedBalance = async (userId) => {
  const wallet = await Wallet.findOne({ ownerId: userId });

  const ledgerSummary = await Ledger.aggregate([
    { $match: { userId } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  let totalCredits = 0;
  let totalDebits = 0;

  for (const item of ledgerSummary) {
    if (item._id === 'credit') totalCredits = item.total;
    if (item._id === 'debit') totalDebits = item.total;
  }

  return {
    userId,
    walletBalance: wallet?.balance || 0,
    ledgerCredits: totalCredits,
    ledgerDebits: totalDebits,
    projectedBalance: totalCredits - totalDebits,
    difference: (wallet?.balance || 0) - (totalCredits - totalDebits),
  };
};

export default {
  check,
  checkAll,
  findInconsistencies,
  getLedgerHistory,
  calculateProjectedBalance,
};
