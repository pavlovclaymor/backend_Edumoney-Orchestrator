/**
 * ============================================
 * WALLET ENGINE (INTERNAL)
 * ============================================
 *
 * Bank-Grade Financial System - Internal Wallet Operations
 *
 * ⚠️ INTERNAL ONLY - Do not import directly
 * ⚠️ Only FinancialOrchestrator can use this module
 *
 * @version 1.0
 */

import Wallet from '../../../models/wallet.js';
import { financialEnforcement } from '../FinancialEnforcementEngine.js';

export class WalletEngine {
  /**
   * Credit wallet - INTERNAL ONLY
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to credit
   * @param {Object} session - Mongoose session
   */
  static async credit(walletId, amount, session = null) {
    financialEnforcement.validateCredit({ _id: walletId }, amount, 'credit');

    const wallet = await Wallet.findById(walletId).session(session);
    if (!wallet) throw new Error('Wallet not found');

    wallet.credit(amount);
    await wallet.save(session ? { session } : {});

    return wallet;
  }

  /**
   * Debit wallet - INTERNAL ONLY
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to debit
   * @param {Object} session - Mongoose session
   */
  static async debit(walletId, amount, session = null) {
    financialEnforcement.validateDebit({ _id: walletId }, amount, 'debit');

    const wallet = await Wallet.findById(walletId).session(session);
    if (!wallet) throw new Error('Wallet not found');

    wallet.debit(amount);
    await wallet.save(session ? { session } : {});

    return wallet;
  }

  /**
   * Find wallet by owner - PUBLIC (read only)
   * @param {string} ownerId - Owner ID
   * @param {string} ownerModel - Owner model
   * @param {Object} session - Mongoose session
   */
  static async findByOwner(ownerId, ownerModel, session = null) {
    const query = Wallet.findOne({ ownerId, ownerModel });
    return session ? query.session(session) : query;
  }

  /**
   * Find wallet by ID - PUBLIC (read only)
   * @param {string} walletId - Wallet ID
   * @param {Object} session - Mongoose session
   */
  static async findById(walletId, session = null) {
    const query = Wallet.findById(walletId);
    return session ? query.session(session) : query;
  }

  /**
   * Validate balance - PUBLIC (read only)
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to validate
   */
  static async validateBalance(walletId, amount) {
    const wallet = await Wallet.findById(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balance < amount) throw new Error('Insufficient balance');
    return true;
  }
}

export default WalletEngine;
