/**
 * ============================================
 * ENFORCED WALLET MODEL
 * ============================================
 *
 * Bank-Grade Financial System - Protected Wallet
 *
 * PURPOSE:
 * This model REPLACES direct wallet.debit/credit calls.
 * It throws errors if called outside FinancialOrchestrator.
 *
 * USAGE:
 * import { EnforcedWallet } from "../core/financial/EnforcedWallet.js";
 *
 * // Only works inside FinancialOrchestrator
 * EnforcedWallet.credit(wallet, amount, session);
 * EnforcedWallet.debit(wallet, amount, session);
 *
 * @version 1.0
 * @date 2026-07-04
 */

import Wallet from '../../models/wallet.js';
import { financialEnforcement } from './FinancialEnforcementEngine.js';

export class EnforcedWallet {
  /**
   * Credit wallet - ONLY works inside FinancialOrchestrator
   */
  static async credit(wallet, amount, session = null) {
    // Validate through enforcement engine
    financialEnforcement.validateCredit(wallet, amount, 'credit');

    // Perform the operation
    wallet.credit(amount);

    const saveOptions = session ? { session } : {};
    await wallet.save(saveOptions);

    return wallet;
  }

  /**
   * Debit wallet - ONLY works inside FinancialOrchestrator
   */
  static async debit(wallet, amount, session = null) {
    // Validate through enforcement engine
    financialEnforcement.validateDebit(wallet, amount, 'debit');

    // Perform the operation
    wallet.debit(amount);

    const saveOptions = session ? { session } : {};
    await wallet.save(saveOptions);

    return wallet;
  }

  /**
   * Credit without save (for batch operations)
   */
  static creditOnly(wallet, amount) {
    financialEnforcement.validateCredit(wallet, amount, 'credit');
    wallet.credit(amount);
    return wallet;
  }

  /**
   * Debit without save (for batch operations)
   */
  static debitOnly(wallet, amount) {
    financialEnforcement.validateDebit(wallet, amount, 'debit');
    wallet.debit(amount);
    return wallet;
  }

  /**
   * Save wallet with enforcement
   */
  static async save(wallet, session = null) {
    const saveOptions = session ? { session } : {};
    await wallet.save(saveOptions);
    return wallet;
  }

  /**
   * Find wallet and credit
   */
  static async findAndCredit(ownerId, ownerModel, amount, session = null) {
    const wallet = await Wallet.findOne({
      ownerId,
      ownerModel,
    }).session(session);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return this.credit(wallet, amount, session);
  }

  /**
   * Find wallet and debit
   */
  static async findAndDebit(ownerId, ownerModel, amount, session = null) {
    const wallet = await Wallet.findOne({
      ownerId,
      ownerModel,
    }).session(session);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return this.debit(wallet, amount, session);
  }
}

export default EnforcedWallet;
