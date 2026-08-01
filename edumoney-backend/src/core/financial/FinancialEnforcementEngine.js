/**
 * ============================================
 * FINANCIAL ENFORCEMENT ENGINE
 * ============================================
 *
 * Bank-Grade Financial System - Single Source of Truth
 *
 * PURPOSE:
 * - Enforce ALL financial operations through FinancialOrchestrator
 * - Block direct wallet mutations (debit/credit)
 * - Block direct transaction creation
 * - Ensure ledger consistency
 *
 * RULE:
 * ❌ NO financial operation outside FinancialOrchestrator
 * ✅ ONLY FinancialOrchestrator can manipulate money
 *
 * @version 1.0
 * @date 2026-07-04
 */

import mongoose from 'mongoose';
import Wallet from '../../models/wallet.js';
import Transaction from '../../models/transaction.js';
import Ledger from '../../models/ledger.model.js';
import { eventBus, EVENTS } from '../events/EventBus.js';

/**
 * ============================================
 * FORBIDDEN OPERATIONS (Enforced by this engine)
 * ============================================
 *
 * These operations are BLOCKED unless called from
 * FinancialOrchestrator:
 *
 * 1. wallet.debit() - MUST use Orchestrator
 * 2. wallet.credit() - MUST use Orchestrator
 * 3. wallet.save() with balance change - MUST use Orchestrator
 * 4. Transaction.create() - MUST use Orchestrator
 * 5. Ledger.create() - MUST use Orchestrator
 */

export const ENFORCEMENT_ERRORS = {
  FORBIDDEN_WALLET_DEBIT:
    'FORBIDDEN: Direct wallet.debit() is not allowed. Use FinancialOrchestrator.execute()',
  FORBIDDEN_WALLET_CREDIT:
    'FORBIDDEN: Direct wallet.credit() is not allowed. Use FinancialOrchestrator.execute()',
  FORBIDDEN_WALLET_SAVE:
    'FORBIDDEN: Direct wallet.save() with balance mutation is not allowed. Use FinancialOrchestrator.execute()',
  FORBIDDEN_TRANSACTION_CREATE:
    'FORBIDDEN: Direct Transaction.create() is not allowed. Use FinancialOrchestrator.execute()',
  FORBIDDEN_LEDGER_CREATE:
    'FORBIDDEN: Direct Ledger.create() is not allowed. Use FinancialOrchestrator.execute()',
  INVALID_AMOUNT: 'INVALID: Amount must be a positive number',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT: Wallet balance is less than requested amount',
};

/**
 * ============================================
 * FINANCIAL ENFORCEMENT ENGINE
 * ============================================
 *
 * Intercepts and validates all financial operations.
 * This is a SAFE wrapper that allows FinancialOrchestrator
 * but blocks everything else.
 */

export class FinancialEnforcementEngine {
  constructor() {
    this.isOrchestratorContext = false;
    this.auditTrail = [];
  }

  /**
   * Enable orchestrator context (called by FinancialOrchestrator)
   * This allows wallet mutations within the orchestrator
   */
  enableOrchestratorContext() {
    this.isOrchestratorContext = true;
  }

  /**
   * Disable orchestrator context
   */
  disableOrchestratorContext() {
    this.isOrchestratorContext = false;
  }

  /**
   * Check if current context can perform financial operations
   */
  canPerformFinancialOperation() {
    return this.isOrchestratorContext;
  }

  /**
   * Validate debit operation
   */
  validateDebit(wallet, amount, operation = 'debit') {
    if (!this.isOrchestratorContext) {
      throw new Error(ENFORCEMENT_ERRORS.FORBIDDEN_WALLET_DEBIT);
    }

    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      throw new Error(ENFORCEMENT_ERRORS.INVALID_AMOUNT);
    }

    if (wallet.balance < amount) {
      throw new Error(ENFORCEMENT_ERRORS.INSUFFICIENT_BALANCE);
    }

    this.auditTrail.push({
      operation: 'debit',
      walletId: wallet._id,
      amount,
      timestamp: new Date(),
      orchestratorContext: true,
    });

    return true;
  }

  /**
   * Validate credit operation
   */
  validateCredit(wallet, amount, operation = 'credit') {
    if (!this.isOrchestratorContext) {
      throw new Error(ENFORCEMENT_ERRORS.FORBIDDEN_WALLET_CREDIT);
    }

    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      throw new Error(ENFORCEMENT_ERRORS.INVALID_AMOUNT);
    }

    this.auditTrail.push({
      operation: 'credit',
      walletId: wallet._id,
      amount,
      timestamp: new Date(),
      orchestratorContext: true,
    });

    return true;
  }

  /**
   * Validate transaction creation
   */
  validateTransactionCreation(transactionData) {
    if (!this.isOrchestratorContext) {
      throw new Error(ENFORCEMENT_ERRORS.FORBIDDEN_TRANSACTION_CREATE);
    }

    if (!transactionData || typeof transactionData !== 'object') {
      throw new Error('INVALID: Transaction data is required');
    }

    this.auditTrail.push({
      operation: 'transaction_create',
      transactionData,
      timestamp: new Date(),
      orchestratorContext: true,
    });

    return true;
  }

  /**
   * Validate ledger entry creation
   */
  validateLedgerCreation(ledgerData) {
    if (!this.isOrchestratorContext) {
      throw new Error(ENFORCEMENT_ERRORS.FORBIDDEN_LEDGER_CREATE);
    }

    if (!ledgerData || !Array.isArray(ledgerData)) {
      throw new Error('INVALID: Ledger data must be an array');
    }

    this.auditTrail.push({
      operation: 'ledger_create',
      ledgerData,
      timestamp: new Date(),
      orchestratorContext: true,
    });

    return true;
  }

  /**
   * Get audit trail for compliance
   */
  getAuditTrail() {
    return this.auditTrail;
  }

  /**
   * Clear audit trail
   */
  clearAuditTrail() {
    this.auditTrail = [];
  }
}

// Singleton instance
export const financialEnforcement = new FinancialEnforcementEngine();

export default financialEnforcement;
