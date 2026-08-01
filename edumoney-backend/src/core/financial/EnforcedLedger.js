/**
 * ============================================
 * ENFORCED LEDGER
 * ============================================
 *
 * Bank-Grade Financial System - Protected Ledger Creation
 *
 * PURPOSE:
 * This REPLACES direct Ledger.create() calls.
 * It throws errors if called outside FinancialOrchestrator.
 *
 * USAGE:
 * import { EnforcedLedger } from "../core/financial/EnforcedLedger.js";
 *
 * // Only works inside FinancialOrchestrator
 * const ledger = await EnforcedLedger.create(data, session);
 *
 * @version 1.0
 * @date 2026-07-04
 */

import Ledger from '../../models/ledger.model.js';
import { financialEnforcement } from './FinancialEnforcementEngine.js';

export class EnforcedLedger {
  /**
   * Create ledger entry - ONLY works inside FinancialOrchestrator
   */
  static async create(ledgerData, session = null) {
    // Validate through enforcement engine
    if (Array.isArray(ledgerData)) {
      ledgerData.forEach((data) => {
        financialEnforcement.validateLedgerCreation(data);
      });
    } else {
      financialEnforcement.validateLedgerCreation(ledgerData);
    }

    // Perform the operation
    const createOptions = session ? { session } : {};

    if (Array.isArray(ledgerData)) {
      const entries = await Ledger.create(ledgerData, createOptions);
      return entries;
    } else {
      const entry = await Ledger.create([ledgerData], createOptions);
      return entry[0];
    }
  }

  /**
   * Find ledger entries by user
   */
  static async findByUser(userId, session = null) {
    const query = Ledger.find({ userId }).sort({ createdAt: -1 });
    if (session) {
      return query.session(session);
    }
    return query;
  }

  /**
   * Find ledger entries by transaction
   */
  static async findByTransaction(transactionId, session = null) {
    const query = Ledger.find({ transactionId });
    if (session) {
      return query.session(session);
    }
    return query;
  }

  /**
   * Get ledger balance for user
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
}

export default EnforcedLedger;
