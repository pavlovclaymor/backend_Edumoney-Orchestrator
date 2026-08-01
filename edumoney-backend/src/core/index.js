/**
 * ============================================
 * CORE MODULE INDEX
 * ============================================
 *
 * ⚠️ BANK-GRADE FINANCIAL SYSTEM ⚠️
 *
 * FINANCIAL RULES:
 * ❌ NO direct wallet mutations (debit/credit)
 * ❌ NO direct transaction creation
 * ❌ NO direct ledger creation
 * ✅ ONLY FinancialOrchestrator.execute() for all money operations
 *
 * @version 2.0
 */

export { eventBus, EVENTS } from './events/EventBus.js';
export { FinancialOrchestrator, TRANSACTION_TYPE } from './financial/FinancialOrchestrator.js';
export { IdempotencyService } from './idempotency/IdempotencyService.js';

// Financial Enforcement Engine (Bank-Grade)
export {
  financialEnforcement,
  ENFORCEMENT_ERRORS,
  FinancialEnforcementEngine,
} from './financial/FinancialEnforcementEngine.js';
export { EnforcedWallet } from './financial/EnforcedWallet.js';
export { EnforcedTransaction } from './financial/EnforcedTransaction.js';
export { EnforcedLedger } from './financial/EnforcedLedger.js';

// Internal Engines (FOR ORCHESTRATOR ONLY)
export { WalletEngine, TransactionEngine, LedgerEngine } from './financial/internal/index.js';

// Re-export workers
export {
  notificationWorker,
  pdfWorker,
  socketWorker,
  auditWorker,
  ledgerWorker,
  initializeWorkers,
  getWorker,
} from '../workers/index.js';
