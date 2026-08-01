/**
 * Ledger Worker
 * Torna o ledger event-driven.
 * Escuta eventos de wallet e cria ledger entries automaticamente.
 *
 * ANTES: Controller cria ledger
 * AGORA: Wallet mutation → Event → Ledger Worker reage
 */

import { eventBus, EVENTS } from '../core/events/EventBus.js';
import Ledger from '../models/ledger.model.js';

class LedgerWorker {
  constructor() {
    this.initialize();
  }

  initialize() {
    // Registrar listeners para eventos de wallet
    eventBus.on(EVENTS.WALLET_CREDITED, async (data) => {
      await this.handleWalletCredited(data);
    });

    eventBus.on(EVENTS.WALLET_DEBITED, async (data) => {
      await this.handleWalletDebited(data);
    });

    console.log('✅ LedgerWorker initialized (event-driven mode)');
  }

  async handleWalletCredited(data) {
    const { userId, amount, balanceAfter, type, transactionId } = data;

    if (!userId || !amount) {
      console.warn('⚠️ LedgerWorker: Missing data for credit entry');
      return;
    }

    try {
      const entry = await Ledger.create({
        transactionId: transactionId || null,
        userId,
        type: 'credit',
        amount,
        balanceAfter: balanceAfter || 0,
      });

      console.log(`✅ LedgerWorker: Credit entry created for ${userId} (${amount} Kz)`);

      // Emitir evento de ledger criado
      eventBus.emit(EVENTS.LEDGER_CREDIT_CREATED, {
        entryId: entry._id,
        userId,
        type: 'credit',
        amount,
        balanceAfter,
      });
    } catch (error) {
      console.error('❌ LedgerWorker: Failed to create credit entry:', error.message);
    }
  }

  async handleWalletDebited(data) {
    const { userId, amount, balanceAfter, type, transactionId } = data;

    if (!userId || !amount) {
      console.warn('⚠️ LedgerWorker: Missing data for debit entry');
      return;
    }

    try {
      const entry = await Ledger.create({
        transactionId: transactionId || null,
        userId,
        type: 'debit',
        amount,
        balanceAfter: balanceAfter || 0,
      });

      console.log(`✅ LedgerWorker: Debit entry created for ${userId} (${amount} Kz)`);

      // Emitir evento de ledger criado
      eventBus.emit(EVENTS.LEDGER_DEBIT_CREATED, {
        entryId: entry._id,
        userId,
        type: 'debit',
        amount,
        balanceAfter,
      });
    } catch (error) {
      console.error('❌ LedgerWorker: Failed to create debit entry:', error.message);
    }
  }

  /**
   * Processar entrada manual de ledger (para casos específicos)
   */
  async createManualEntry(data) {
    const { transactionId, userId, type, amount, balanceAfter } = data;

    try {
      const entry = await Ledger.create({
        transactionId,
        userId,
        type,
        amount,
        balanceAfter,
      });

      eventBus.emit(EVENTS.LEDGER_CREATED, {
        entryId: entry._id,
        userId,
        type,
        amount,
      });

      return entry;
    } catch (error) {
      console.error('LedgerWorker: Manual entry failed:', error.message);
      throw error;
    }
  }
}

// Singleton
export const ledgerWorker = new LedgerWorker();
export default ledgerWorker;
