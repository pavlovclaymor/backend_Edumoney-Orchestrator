/**
 * Advanced Reconciliation Engine
 * Reconciliação por tenant, wallet, período com anomaly scoring.
 */

import Wallet from '../../models/wallet.js';
import Ledger from '../../models/ledger.model.js';
import { redisPublisher } from '../redis/RedisPublisher.js';

class AdvancedReconciliation {
  constructor() {
    this.anomalyThreshold = 0.5;
    this.lastRun = null;
  }

  /**
   * Calcular anomaly score
   */
  calculateAnomalyScore(walletData, ledgerData) {
    let score = 0;

    // Diferença absoluta
    const differencePercent =
      Math.abs(walletData.balance - ledgerData.calculatedBalance) / Math.max(walletData.balance, 1);
    score += Math.min(differencePercent, 1) * 0.4;

    // Entries sem ledger
    if (ledgerData.entryCount === 0 && walletData.balance > 0) {
      score += 0.2;
    }

    // Mudanças recentes
    if (ledgerData.recentChanges > 10) {
      score += 0.2;
    }

    // Entries faltando
    const expectedEntries = Math.floor(Math.abs(walletData.balance) / 1000);
    if (ledgerData.entryCount < expectedEntries * 0.5) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  /**
   * Reconciliar wallet específica
   */
  async reconcileWallet(walletId) {
    const wallet = await Wallet.findById(walletId);

    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    return await this.reconcileByOwner(wallet.ownerId, wallet.balance);
  }

  /**
   * Reconciliar por owner
   */
  async reconcileByOwner(ownerId, walletBalance, tenantId = 'default') {
    const ledgerEntries = await Ledger.find({
      userId: ownerId,
      ...(tenantId !== 'default' && { tenantId }),
    });

    let totalCredits = 0;
    let totalDebits = 0;
    let recentChanges = 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const entry of ledgerEntries) {
      if (entry.type === 'credit') totalCredits += entry.amount;
      if (entry.type === 'debit') totalDebits += entry.amount;
      if (entry.createdAt > oneDayAgo) recentChanges++;
    }

    const calculatedBalance = totalCredits - totalDebits;
    const difference = walletBalance - calculatedBalance;
    const isConsistent = Math.abs(difference) < 0.01;

    const anomalyScore = this.calculateAnomalyScore(
      { balance: walletBalance, entryCount: ledgerEntries.length },
      { calculatedBalance, entryCount: ledgerEntries.length, recentChanges },
    );

    const result = {
      success: true,
      ownerId,
      tenantId,
      walletBalance,
      ledgerCredits: totalCredits,
      ledgerDebits: totalDebits,
      ledgerBalance: calculatedBalance,
      difference,
      isConsistent,
      anomalyScore,
      status: isConsistent ? 'OK' : anomalyScore > this.anomalyThreshold ? 'CRITICAL' : 'WARNING',
      entryCount: ledgerEntries.length,
      recentChanges,
      checkedAt: new Date().toISOString(),
    };

    if (!isConsistent) {
      await redisPublisher.emitInconsistencyDetected(result);
    }

    return result;
  }

  /**
   * Reconciliar todas as wallets de um tenant
   */
  async reconcileTenant(tenantId) {
    const wallets = await Wallet.find({});

    const results = [];

    for (const wallet of wallets) {
      const result = await this.reconcileByOwner(wallet.ownerId, wallet.balance, tenantId);
      results.push({
        walletId: wallet._id,
        ownerId: wallet.ownerId,
        ownerModel: wallet.ownerModel,
        ...result,
      });
    }

    this.lastRun = new Date();

    return {
      summary: {
        tenantId,
        totalWallets: results.length,
        consistentWallets: results.filter((r) => r.isConsistent).length,
        criticalWallets: results.filter((r) => r.status === 'CRITICAL').length,
        avgAnomalyScore: results.reduce((sum, r) => sum + r.anomalyScore, 0) / results.length,
        checkedAt: this.lastRun.toISOString(),
      },
      results,
    };
  }

  /**
   * Encontrar anomalias críticas
   */
  async findCriticalAnomalies(tenantId = null) {
    const wallets = await Wallet.find({});

    const anomalies = [];

    for (const wallet of wallets) {
      const result = await this.reconcileByOwner(wallet.ownerId, wallet.balance, tenantId);
      if (result.anomalyScore > this.anomalyThreshold) {
        anomalies.push(result);
      }
    }

    return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
  }

  /**
   * Verificar consistência de transação
   */
  async verifyTransaction(transactionId, tenantId = 'default') {
    const ledgerEntries = await Ledger.find({
      transactionId,
      ...(tenantId !== 'default' && { tenantId }),
    });

    if (ledgerEntries.length === 0) {
      return { verified: false, issue: 'NO_LEDGER_ENTRIES' };
    }

    const credits = ledgerEntries.filter((e) => e.type === 'credit');
    const debits = ledgerEntries.filter((e) => e.type === 'debit');

    return {
      verified: true,
      transactionId,
      entryCount: ledgerEntries.length,
      credits: credits.length,
      debits: debits.length,
    };
  }

  getReconciliationHistory() {
    return { lastRun: this.lastRun, anomalyThreshold: this.anomalyThreshold };
  }

  setAnomalyThreshold(threshold) {
    this.anomalyThreshold = threshold;
  }
}

export const advancedReconciliation = new AdvancedReconciliation();
export default advancedReconciliation;
