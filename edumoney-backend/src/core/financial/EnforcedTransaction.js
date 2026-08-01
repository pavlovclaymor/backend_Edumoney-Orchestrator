/**
 * ============================================
 * ENFORCED TRANSACTION
 * ============================================
 *
 * Bank-Grade Financial System - Protected Transaction Creation
 *
 * PURPOSE:
 * This REPLACES direct Transaction.create() calls.
 * It throws errors if called outside FinancialOrchestrator.
 *
 * USAGE:
 * import { EnforcedTransaction } from "../core/financial/EnforcedTransaction.js";
 *
 * // Only works inside FinancialOrchestrator
 * const transaction = await EnforcedTransaction.create(data, session);
 *
 * @version 1.0
 * @date 2026-07-04
 */

import Transaction from '../../models/transaction.js';
import { financialEnforcement } from './FinancialEnforcementEngine.js';

export class EnforcedTransaction {
  /**
   * Create transaction - ONLY works inside FinancialOrchestrator
   */
  static async create(transactionData, session = null) {
    // Validate through enforcement engine
    if (Array.isArray(transactionData)) {
      transactionData.forEach((data) => {
        financialEnforcement.validateTransactionCreation(data);
      });
    } else {
      financialEnforcement.validateTransactionCreation(transactionData);
    }

    // Perform the operation
    const createOptions = session ? { session } : {};

    if (Array.isArray(transactionData)) {
      const transactions = await Transaction.create(transactionData, createOptions);
      return transactions;
    } else {
      const transaction = await Transaction.create([transactionData], createOptions);
      return transaction[0];
    }
  }

  /**
   * Find transaction by ID
   */
  static async findById(transactionId, session = null) {
    const query = Transaction.findById(transactionId);
    if (session) {
      return query.session(session);
    }
    return query;
  }

  /**
   * Find transactions by query
   */
  static async find(query, session = null) {
    const mongoQuery = Transaction.find(query);
    if (session) {
      return mongoQuery.session(session);
    }
    return mongoQuery;
  }
}

export default EnforcedTransaction;
