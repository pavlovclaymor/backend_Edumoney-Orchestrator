/**
 * Reconciliation Engine
 * Compara wallet.balance vs SUM(ledger.credit - ledger.debit).
 * Gera alertas se houver divergência.
 */

import Wallet from '../../models/wallet.js';
import Ledger from '../../models/ledger.model.js';
import { redisPublisher } from './RedisPublisher.js';

class ReconciliationEngine {
  constructor() {
    this.lastRun = null;
    this.inconsistencies = [];
  }

  /**
   * Verificar consistência de uma wallet
   * @param {string} walletId - ID da wallet
   */
  async checkWallet(walletId) {
    const wallet = await Wallet.findById(walletId);

    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    return await this.checkByOwner(wallet.ownerId, wallet.balance);
  }

  /**
   * Verificar consistência por ownerId
   */
  async checkByOwner(ownerId, walletBalance = null) {
    // Buscar wallet se não fornecida
    if (walletBalance === null) {
      const wallet = await Wallet.findOne({ ownerId });
      if (!wallet) {
        return { success: false, error: 'Wallet not found' };
      }
      walletBalance = wallet.balance;
    }

    // Calcular soma do ledger
    const ledgerSummary = await Ledger.aggregate([
      { $match: { userId: ownerId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let totalCredits = 0;
    let totalDebits = 0;

    for (const item of ledgerSummary) {
      if (item._id === 'credit') totalCredits = item.total;
      if (item._id === 'debit') totalDebits = item.total;
    }

    const ledgerBalance = totalCredits - totalDebits;
    const difference = walletBalance - ledgerBalance;
    const isConsistent = Math.abs(difference) < 0.01; // Tolerância de 1 cêntimo

    const result = {
      success: true,
      ownerId,
      walletBalance,
      ledgerCredits: totalCredits,
      ledgerDebits: totalDebits,
      ledgerBalance,
      difference,
      isConsistent,
      status: isConsistent ? 'OK' : 'MISMATCH',
      checkedAt: new Date().toISOString(),
    };

    // Se inconsistente, emitir alerta
    if (!isConsistent) {
      this.inconsistencies.push(result);

      // Emitir evento de inconsistência
      await redisPublisher.emitInconsistencyDetected({
        ownerId,
        walletBalance,
        ledgerBalance,
        difference,
        ledgerCredits: totalCredits,
        ledgerDebits: totalDebits,
      });
    }

    return result;
  }

  /**
   * Verificar todas as wallets
   */
  async checkAll() {
    const wallets = await Wallet.find({});
    const results = [];

    for (const wallet of wallets) {
      const result = await this.checkByOwner(wallet.ownerId, wallet.balance);
      results.push({
        walletId: wallet._id,
        ownerId: wallet.ownerId,
        ownerModel: wallet.ownerModel,
        ...result,
      });
    }

    this.lastRun = new Date();

    return {
      totalWallets: results.length,
      consistentWallets: results.filter((r) => r.isConsistent).length,
      inconsistentWallets: results.filter((r) => !r.isConsistent).length,
      inconsistencies: results.filter((r) => !r.isConsistent),
      checkedAt: this.lastRun.toISOString(),
    };
  }

  /**
   * Verificar apenas inconsistências
   */
  async findInconsistencies() {
    const wallets = await Wallet.find({});
    const inconsistencies = [];

    for (const wallet of wallets) {
      const result = await this.checkByOwner(wallet.ownerId, wallet.balance);
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
  }

  /**
   * Obter histórico de inconsistências
   */
  getInconsistencyHistory() {
    return this.inconsistencies;
  }

  /**
   * Limpar histórico
   */
  clearHistory() {
    this.inconsistencies = [];
  }

  /**
   * Verificar período específico
   */
  async checkPeriod(ownerId, startDate, endDate) {
    const ledgerEntries = await Ledger.find({
      userId: ownerId,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });

    let totalCredits = 0;
    let totalDebits = 0;

    for (const entry of ledgerEntries) {
      if (entry.type === 'credit') totalCredits += entry.amount;
      if (entry.type === 'debit') totalDebits += entry.amount;
    }

    return {
      ownerId,
      period: { startDate, endDate },
      totalCredits,
      totalDebits,
      netChange: totalCredits - totalDebits,
      entryCount: ledgerEntries.length,
    };
  }

  /**
   * Calcular saldo projetado
   */
  async calculateProjectedBalance(ownerId) {
    const ledgerSummary = await Ledger.aggregate([
      { $match: { userId: ownerId } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    let totalCredits = 0;
    let totalDebits = 0;

    for (const item of ledgerSummary) {
      if (item._id === 'credit') totalCredits = item.total;
      if (item._id === 'debit') totalDebits = item.total;
    }

    return {
      ownerId,
      projectedBalance: totalCredits - totalDebits,
      totalCredits,
      totalDebits,
    };
  }
}

// Singleton
export const reconciliationEngine = new ReconciliationEngine();
export default reconciliationEngine;
