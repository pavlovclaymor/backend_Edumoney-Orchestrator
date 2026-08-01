/**
 * ============================================
 * LEDGER ENGINE (INTERNAL)
 * ============================================
 *
 * Bank-Grade Financial System - Internal Ledger Operations
 *
 * ⚠️ INTERNAL ONLY - Do not import directly
 * ⚠️ Only FinancialOrchestrator can use this module
 *
 * @version 1.0
 */

import Ledger from '../../../models/ledger.model.js';
import { financialEnforcement } from '../FinancialEnforcementEngine.js';

export class LedgerEngine {
  /**
   * Create ledger entry - INTERNAL ONLY
   * @param {Object|Array} ledgerData - Ledger data
   * @param {Object} session - Mongoose session
   */
  static async create(ledgerData, session = null) {
    if (Array.isArray(ledgerData)) {
      ledgerData.forEach((data) => {
        financialEnforcement.validateLedgerCreation(data);
      });
    } else {
      financialEnforcement.validateLedgerCreation(ledgerData);
    }

    const options = session ? { session, ordered: true } : {};

    if (Array.isArray(ledgerData)) {
      const entries = await Ledger.create(ledgerData, options);
      return entries;
    } else {
      const [entry] = await Ledger.create([ledgerData], options);
      return entry;
    }
  }

  /**
   * Find ledger entries by user - PUBLIC (read only)
   * @param {string} userId - User ID
   * @param {Object} session - Mongoose session
   */
  static async findByUser(userId, session = null) {
    const query = Ledger.find({ userId }).sort({ createdAt: -1 });
    return session ? query.session(session) : query;
  }

  /**
   * Find ledger entries by transaction - PUBLIC (read only)
   * @param {string} transactionId - Transaction ID
   * @param {Object} session - Mongoose session
   */
  static async findByTransaction(transactionId, session = null) {
    const query = Ledger.find({ transactionId });
    return session ? query.session(session) : query;
  }

  /**
   * Get calculated balance from ledger - PUBLIC (read only)
   * @param {string} userId - User ID
   * @param {Object} session - Mongoose session
   */
  static async getBalance(userId, session = null) {
    const entries = await this.findByUser(userId, session);

    let credits = 0;
    let debits = 0;

    entries.forEach((entry) => {
      if (entry.type === 'credit') {
        credits += entry.amount;
      } else if (entry.type === 'debit') {
        debits += entry.amount;
      }
    });

    return {
      userId,
      credits,
      debits,
      balance: credits - debits,
    };
  }

  /**
   * Verify ledger consistency - PUBLIC (read only)
   * @param {string} userId - User ID
   * @param {number} walletBalance - Current wallet balance
   * @param {Object} session - Mongoose session
   */
  static async verifyConsistency(userId, walletBalance, session = null) {
    const ledgerBalance = await this.getBalance(userId, session);
    const isConsistent = ledgerBalance.balance === walletBalance;

    return {
      userId,
      walletBalance,
      ledgerBalance: ledgerBalance.balance,
      isConsistent,
      credits: ledgerBalance.credits,
      debits: ledgerBalance.debits,
    };
  }
}

export default LedgerEngine;
