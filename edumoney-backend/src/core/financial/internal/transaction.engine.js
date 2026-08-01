/**
 * ============================================
 * TRANSACTION ENGINE (INTERNAL)
 * ============================================
 *
 * Bank-Grade Financial System - Internal Transaction Operations
 *
 * ⚠️ INTERNAL ONLY - Do not import directly
 * ⚠️ Only FinancialOrchestrator can use this module
 *
 * @version 1.0
 */

import Transaction from '../../../models/transaction.js';
import { financialEnforcement } from '../FinancialEnforcementEngine.js';

export class TransactionEngine {
  /**
   * Create transaction - INTERNAL ONLY
   * @param {Object} transactionData - Transaction data
   * @param {Object} session - Mongoose session
   */
  static async create(transactionData, session = null) {
    financialEnforcement.validateTransactionCreation(transactionData);

    const options = session ? { session, ordered: true } : {};

    if (Array.isArray(transactionData)) {
      const transactions = await Transaction.create(transactionData, options);
      return transactions;
    } else {
      const [transaction] = await Transaction.create([transactionData], options);
      return transaction;
    }
  }

  /**
   * Find transaction by ID - PUBLIC (read only)
   * @param {string} transactionId - Transaction ID
   * @param {Object} session - Mongoose session
   */
  static async findById(transactionId, session = null) {
    const query = Transaction.findById(transactionId);
    return session ? query.session(session) : query;
  }

  /**
   * Find transactions by query - PUBLIC (read only)
   * @param {Object} query - MongoDB query
   * @param {Object} session - Mongoose session
   */
  static async find(query, session = null) {
    const mongoQuery = Transaction.find(query).sort({ createdAt: -1 });
    return session ? mongoQuery.session(session) : mongoQuery;
  }

  /**
   * Find transactions by user - PUBLIC (read only)
   * @param {string} userId - User ID
   * @param {Object} session - Mongoose session
   */
  static async findByUser(userId, session = null) {
    const query = Transaction.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).sort({ createdAt: -1 });
    return session ? query.session(session) : query;
  }

  /**
   * Update transaction status - INTERNAL ONLY
   * @param {string} transactionId - Transaction ID
   * @param {string} status - New status
   * @param {Object} session - Mongoose session
   */
  static async updateStatus(transactionId, status, session = null) {
    const options = session ? { session } : {};
    return Transaction.findByIdAndUpdate(transactionId, { status }, options);
  }
}

export default TransactionEngine;
