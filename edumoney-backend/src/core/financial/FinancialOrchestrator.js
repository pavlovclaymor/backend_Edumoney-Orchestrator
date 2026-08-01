/**
 * ============================================
 * FINANCIAL ORCHESTRATOR
 * ============================================
 *
 * Bank-Grade Financial System - Single Source of Truth
 *
 * PURPOSE:
 * - Central entry point for ALL financial operations
 * - Enforces financial integrity
 * - Manages atomicity and consistency
 *
 * RULE:
 * ❌ NO financial operation outside this orchestrator
 * ✅ ONLY this orchestrator can manipulate money
 *
 * @version 2.0
 * @date 2026-07-04
 */

import mongoose from 'mongoose';
import Wallet from '../../models/wallet.js';
import Transaction from '../../models/transaction.js';
import Ledger from '../../models/ledger.model.js';
import Invoice from '../../models/invoice.model.js';
import User from '../../models/user.model.js';
import Merchant from '../../models/merchant.model.js';
import School from '../../models/school.model.js';
import Rupe from '../../models/rupe.model.js';
import bcrypt from 'bcrypt';
import { eventBus, EVENTS } from '../events/EventBus.js';
import { IdempotencyService } from '../idempotency/IdempotencyService.js';
import { financialEnforcement } from './FinancialEnforcementEngine.js';
import { EnforcedWallet } from './EnforcedWallet.js';
import { EnforcedTransaction } from './EnforcedTransaction.js';
import { EnforcedLedger } from './EnforcedLedger.js';
import { processTransaction } from '../../services/finance.service.js';

export const TRANSACTION_TYPE = {
  TRANSFER: 'TRANSFER',
  INVOICE_PAYMENT: 'INVOICE_PAYMENT',
  INVOICE_CREATION: 'INVOICE_CREATION',
  RECHARGE: 'RECHARGE',
  QR_PAYMENT: 'QR_PAYMENT',
  SCHOOL_PAYMENT: 'SCHOOL_PAYMENT',
  CASHOUT: 'CASHOUT',
};

export class FinancialOrchestrator {
  /**
   * Executar operação financeira
   * @param {Object} options
   * @param {string} options.type - Tipo de transação
   * @param {Object} options.payload - Dados da transação
   * @param {mongoose.ClientSession} options.session - Sessão (opcional)
   * @returns {Object} Resultado da transação
   */
  static async execute({ type, payload, session = null }) {
    const startTime = Date.now();

    // Criar sessão se não fornecida
    let shouldEndSession = false;
    let activeSession = session;

    if (!activeSession) {
      activeSession = await mongoose.startSession();
      activeSession.startTransaction();
      shouldEndSession = true;
    }

    try {
      // ENABLE ENFORCEMENT: This allows wallet/transaction operations
      financialEnforcement.enableOrchestratorContext();

      let result;

      switch (type) {
        case TRANSACTION_TYPE.TRANSFER:
          result = await this.handleTransfer(payload, activeSession);
          break;

        case TRANSACTION_TYPE.INVOICE_PAYMENT:
          result = await this.handleInvoicePayment(payload, activeSession);
          break;

        case TRANSACTION_TYPE.INVOICE_CREATION:
          result = await this.handleInvoiceCreation(payload, activeSession);
          break;

        case TRANSACTION_TYPE.RECHARGE:
          result = await this.handleRecharge(payload, activeSession);
          break;

        case TRANSACTION_TYPE.QR_PAYMENT:
          result = await this.handleQRPayment(payload, activeSession);
          break;

        case TRANSACTION_TYPE.SCHOOL_PAYMENT:
          result = await this.handleSchoolPayment(payload, activeSession);
          break;

        case TRANSACTION_TYPE.CASHOUT:
          result = await this.handleCashout(payload, activeSession);
          break;

        default:
          throw new Error(`Tipo de transação desconhecido: ${type}`);
      }

      // Commit da transação
      if (shouldEndSession) {
        await activeSession.commitTransaction();
      }

      // Emitir evento de sucesso
      eventBus.emit(EVENTS.TRANSACTION_COMPLETED, {
        type,
        payload,
        result,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      // Abortar transação em caso de erro
      if (shouldEndSession) {
        await activeSession.abortTransaction();
      }

      // Emitir evento de falha
      eventBus.emit(EVENTS.TRANSACTION_FAILED, {
        type,
        payload,
        error: error.message,
        duration: Date.now() - startTime,
      });

      throw error;
    } finally {
      // DISABLE ENFORCEMENT: Block financial operations outside orchestrator
      financialEnforcement.disableOrchestratorContext();

      if (shouldEndSession) {
        activeSession.endSession();
      }
    }
  }

  /**
   * Processar transferência entre estudantes
   */
  static async handleTransfer(payload, session) {
    const { senderId, receiverId, amount, description, pin } = payload;

    // Validar PIN
    const sender = await User.findById(senderId).select('+pin').session(session);
    if (!sender) throw new Error('Remetente não encontrado');

    const isMatch = await bcrypt.compare(pin, sender.pin);
    if (!isMatch) throw new Error('PIN incorreto');

    // Buscar carteiras
    const senderWallet = await Wallet.findOne({
      ownerId: senderId,
      ownerModel: 'User',
    }).session(session);

    const receiverWallet = await Wallet.findOne({
      ownerId: receiverId,
      ownerModel: 'User',
    }).session(session);

    if (!senderWallet || !receiverWallet) {
      throw new Error('Carteira não encontrada');
    }

    if (senderWallet.balance < amount) {
      throw new Error('Saldo insuficiente');
    }

    // Wallet mutations
    senderWallet.debit(amount);
    receiverWallet.credit(amount);

    await senderWallet.save({ session });
    await receiverWallet.save({ session });

    // Emitir eventos de wallet
    eventBus.emit(EVENTS.WALLET_DEBITED, {
      userId: senderId,
      amount,
      balanceAfter: senderWallet.balance,
      type: 'transfer',
    });

    eventBus.emit(EVENTS.WALLET_CREDITED, {
      userId: receiverId,
      amount,
      balanceAfter: receiverWallet.balance,
      type: 'transfer',
    });

    // Criar transação
    const [transaction] = await Transaction.create(
      [
        {
          senderId,
          senderType: 'User',
          receiverId,
          receiverType: 'User',
          amount,
          type: 'transfer',
          description: description || 'Transferência EDUMONEY',
          status: 'completed',
        },
      ],
      { session },
    );

    // Criar ledger entries
    await this.createLedgerEntries(
      transaction._id,
      [
        { userId: senderId, type: 'debit', amount, balanceAfter: senderWallet.balance },
        { userId: receiverId, type: 'credit', amount, balanceAfter: receiverWallet.balance },
      ],
      session,
    );

    eventBus.emit(EVENTS.TRANSACTION_CREATED, {
      transactionId: transaction._id,
      type: 'transfer',
    });

    return { transaction, senderWallet, receiverWallet };
  }

  /**
   * Processar pagamento de invoice
   */
  /**
   * Handler para criação de Invoice
   * Cria Transaction para audit trail (sem movimentar dinheiro)
   */
  static async handleInvoiceCreation(payload, session) {
    const { merchantId, userId, amount, invoiceId, paymentMethod, status } = payload;

    // Para invoices, não há movimentação de dinheiro ainda
    // Apenas criamos a transação para audit trail
    const transactions = await Transaction.create(
      [
        {
          receiverId: merchantId,
          receiverType: 'Merchant',
          senderId: userId || 'SYSTEM',
          senderType: 'User',
          amount,
          type: 'invoice_created',
          paymentMethod,
          rupeReference: invoiceId,
          status,
          direction: 'pending',
        },
      ],
      { session },
    );

    // Criar ledger entry para o comerciante
    await this.createLedgerEntries(
      transactions[0]._id,
      [{ userId: merchantId, type: 'pending', amount, balanceAfter: 0 }],
      session,
    );

    eventBus.emit(EVENTS.PAYMENT_COMPLETED, {
      transactionId: transactions[0]._id,
      type: 'invoice_creation',
      merchantId,
      amount,
    });

    return { transactions };
  }

  static async handleInvoicePayment(payload, session) {
    const { userId, rupeReference, invoiceId } = payload;

    // Validar PIN
    const user = await User.findById(userId).select('+pin').session(session);
    if (!user) throw new Error('Usuário não encontrado');

    const isMatch = await bcrypt.compare(payload.pin, user.pin);
    if (!isMatch) throw new Error('PIN incorreto');

    // Buscar invoice com LOCK atômico
    let invoice;
    if (mongoose.Types.ObjectId.isValid(rupeReference || invoiceId)) {
      invoice = await Invoice.findOneAndUpdate(
        { _id: invoiceId || rupeReference, status: 'pending' },
        { $set: { status: 'processing' } },
        { new: true, session },
      );
    } else {
      invoice = await Invoice.findOneAndUpdate(
        { rupeReference, status: 'pending' },
        { $set: { status: 'processing' } },
        { new: true, session },
      );
    }

    if (!invoice) {
      throw new Error('Invoice não encontrada, já paga ou em processamento');
    }

    // Buscar wallet do estudante
    const studentWallet = await Wallet.findOne({
      ownerId: userId,
      ownerModel: 'User',
    }).session(session);

    if (!studentWallet) throw new Error('Carteira não encontrada');
    if (studentWallet.balance < invoice.totalAmount) {
      throw new Error('Saldo insuficiente');
    }

    // Debit do estudante
    studentWallet.debit(invoice.totalAmount);
    await studentWallet.save({ session });

    eventBus.emit(EVENTS.WALLET_DEBITED, {
      userId,
      amount: invoice.totalAmount,
      balanceAfter: studentWallet.balance,
      type: 'invoice_payment',
    });

    // Credit do comerciante
    const merchantWallet = await Wallet.findOne({
      ownerId: invoice.merchantId,
      ownerModel: 'Merchant',
    }).session(session);

    if (merchantWallet) {
      merchantWallet.credit(invoice.totalAmount);
      await merchantWallet.save({ session });

      eventBus.emit(EVENTS.WALLET_CREDITED, {
        userId: invoice.merchantId,
        amount: invoice.totalAmount,
        balanceAfter: merchantWallet.balance,
        type: 'invoice_payment',
      });
    }

    // Atualizar invoice
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.isLocked = true;
    invoice.studentId = userId;
    invoice.clientName = user.name;
    invoice.clientEmail = user.email;
    await invoice.save({ session });

    // Criar transação
    const [transaction] = await Transaction.create(
      [
        {
          senderId: userId,
          senderType: 'User',
          receiverId: invoice.merchantId,
          receiverType: 'Merchant',
          amount: invoice.totalAmount,
          type: 'payment',
          status: 'completed',
          description: `Pagamento da invoice ${invoice.invoiceNumber}`,
        },
      ],
      { session },
    );

    // Criar ledger entries
    await this.createLedgerEntries(
      transaction._id,
      [
        { userId, type: 'debit', amount: invoice.totalAmount, balanceAfter: studentWallet.balance },
        {
          userId: invoice.merchantId,
          type: 'credit',
          amount: invoice.totalAmount,
          balanceAfter: merchantWallet?.balance || 0,
        },
      ],
      session,
    );

    eventBus.emit(EVENTS.PAYMENT_COMPLETED, {
      transactionId: transaction._id,
      invoiceId: invoice._id,
      amount: invoice.totalAmount,
      userId,
      merchantId: invoice.merchantId,
    });

    eventBus.emit(EVENTS.INVOICE_PAID, {
      invoiceId: invoice._id,
      amount: invoice.totalAmount,
    });

    return { transaction, invoice, studentWallet };
  }

  /**
   * Processar recarga
   */
  static async handleRecharge(payload, session) {
    const { userId, rechargeId, amount } = payload;

    const recharge = await mongoose.model('Recharge').findById(rechargeId).session(session);
    if (!recharge) throw new Error('Recarga não encontrada');

    const wallet = await Wallet.findOne({
      ownerId: userId,
      ownerModel: 'User',
    }).session(session);

    if (!wallet) throw new Error('Carteira não encontrada');

    // Credit na wallet
    wallet.credit(amount);
    await wallet.save({ session });

    eventBus.emit(EVENTS.WALLET_CREDITED, {
      userId,
      amount,
      balanceAfter: wallet.balance,
      type: 'recharge',
    });

    // Criar transação
    const [transaction] = await Transaction.create(
      [
        {
          senderId: recharge._id,
          senderType: 'Rupe',
          receiverId: userId,
          receiverType: 'User',
          amount,
          type: 'recharge',
          description: `Recarga via RUPE ${recharge.rupeReference}`,
          status: 'completed',
        },
      ],
      { session },
    );

    // Criar ledger entry
    await this.createLedgerEntries(
      transaction._id,
      [{ userId, type: 'credit', amount, balanceAfter: wallet.balance }],
      session,
    );

    eventBus.emit(EVENTS.RECHARGE_COMPLETED, {
      transactionId: transaction._id,
      userId,
      amount,
    });

    return { transaction, wallet };
  }

  /**
   * Processar QR payment
   */
  static async handleQRPayment(payload, session) {
    const { userId, merchantId, amount, pin } = payload;

    // Validar PIN
    const user = await User.findById(userId).select('+pin').session(session);
    if (!user) throw new Error('Usuário não encontrado');

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) throw new Error('PIN incorreto');

    // Usar processTransaction do finance.service
    const transaction = await processTransaction({
      senderId: userId,
      senderType: 'User',
      receiverId: merchantId,
      receiverType: 'Merchant',
      externalReference: `QR-${Date.now()}`,
      amount,
      type: 'payment',
      description: 'QR Payment',
      session,
    });

    // Buscar wallets para eventos
    const studentWallet = await Wallet.findOne({
      ownerId: userId,
      ownerModel: 'User',
    }).session(session);

    const merchantWallet = await Wallet.findOne({
      ownerId: merchantId,
      ownerModel: 'Merchant',
    }).session(session);

    if (studentWallet) {
      eventBus.emit(EVENTS.WALLET_DEBITED, {
        userId,
        amount,
        balanceAfter: studentWallet.balance,
        type: 'qr_payment',
      });
    }

    if (merchantWallet) {
      eventBus.emit(EVENTS.WALLET_CREDITED, {
        userId: merchantId,
        amount,
        balanceAfter: merchantWallet.balance,
        type: 'qr_payment',
      });
    }

    eventBus.emit(EVENTS.PAYMENT_COMPLETED, {
      transactionId: transaction._id,
      type: 'qr',
      userId,
      merchantId,
      amount,
    });

    return { transaction, studentWallet, merchantWallet };
  }

  /**
   * Processar pagamento para escola
   */
  static async handleSchoolPayment(payload, session) {
    const { userId, rupeReference, pin } = payload;

    // Validar PIN
    const user = await User.findById(userId).select('+pin').session(session);
    if (!user) throw new Error('Usuário não encontrado');

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) throw new Error('PIN incorreto');

    const rupe = await Rupe.findOne({
      referencia: rupeReference,
      estado: 'PENDENTE',
    }).session(session);

    if (!rupe) throw new Error('RUPE não encontrado ou já processado');

    // Usar processTransaction
    const transaction = await processTransaction({
      senderId: userId,
      senderType: 'User',
      receiverId: rupe.schoolId,
      receiverType: 'School',
      externalReference: `SCHOOL-${Date.now()}`,
      amount: rupe.valor,
      type: 'payment',
      description: 'Pagamento escola',
      session,
    });

    // Atualizar RUPE
    await Rupe.findByIdAndUpdate(rupe._id, { estado: 'PAGO' }, { session });

    // Buscar wallets para eventos
    const studentWallet = await Wallet.findOne({
      ownerId: userId,
      ownerModel: 'User',
    }).session(session);

    const schoolWallet = await Wallet.findOne({
      ownerId: rupe.schoolId,
      ownerModel: 'School',
    }).session(session);

    if (studentWallet) {
      eventBus.emit(EVENTS.WALLET_DEBITED, {
        userId,
        amount: rupe.valor,
        balanceAfter: studentWallet.balance,
        type: 'school_payment',
      });
    }

    if (schoolWallet) {
      eventBus.emit(EVENTS.WALLET_CREDITED, {
        userId: rupe.schoolId,
        amount: rupe.valor,
        balanceAfter: schoolWallet.balance,
        type: 'school_payment',
      });
    }

    eventBus.emit(EVENTS.PAYMENT_COMPLETED, {
      transactionId: transaction._id,
      type: 'school',
      userId,
      schoolId: rupe.schoolId,
      amount: rupe.valor,
    });

    return { transaction, studentWallet, schoolWallet };
  }

  /**
   * Processar cashout
   */
  static async handleCashout(payload, session) {
    const { merchantId, amount, bankAccount } = payload;

    const merchant = await Merchant.findById(merchantId).session(session);
    if (!merchant) throw new Error('Comerciante não encontrado');

    const school = await School.findById(merchant.schoolId).session(session);
    if (!school) throw new Error('Escola não encontrada');

    const wallet = await Wallet.findOne({
      ownerId: merchantId,
      ownerModel: 'Merchant',
    }).session(session);

    if (!wallet) throw new Error('Carteira não encontrada');
    if (wallet.balance < amount) throw new Error('Saldo insuficiente');

    const feePercent = school.feeRate || 0;
    const feeAmount = amount * feePercent;
    const netAmount = amount - feeAmount;

    // Debit do comerciante
    wallet.debit(amount);
    await wallet.save({ session });

    eventBus.emit(EVENTS.WALLET_DEBITED, {
      userId: merchantId,
      amount,
      balanceAfter: wallet.balance,
      type: 'cashout',
    });

    // Credit da escola (fee)
    const schoolWallet = await Wallet.findOne({
      ownerId: school._id,
      ownerModel: 'School',
    }).session(session);

    if (schoolWallet) {
      schoolWallet.credit(feeAmount);
      await schoolWallet.save({ session });

      eventBus.emit(EVENTS.WALLET_CREDITED, {
        userId: school._id,
        amount: feeAmount,
        balanceAfter: schoolWallet.balance,
        type: 'cashout_fee',
      });
    }

    // Criar transações
    const transactions = await Transaction.create(
      [
        {
          senderId: merchantId,
          receiverId: merchantId,
          senderType: 'Merchant',
          receiverType: 'Merchant',
          amount: netAmount,
          type: 'cashout',
          description: `Levantamento para conta bancária (Fee: ${feePercent}%)`,
          status: 'completed',
          direction: 'outgoing',
        },
        {
          senderId: merchantId,
          receiverId: school._id,
          senderType: 'Merchant',
          receiverType: 'School',
          amount: feeAmount,
          type: 'payment',
          description: `Fee da escola (${feePercent}%)`,
          status: 'completed',
          direction: 'incoming',
        },
      ],
      { session, ordered: true },
    );

    // Criar ledger entries
    await this.createLedgerEntries(
      transactions[0]._id,
      [
        { userId: merchantId, type: 'debit', amount: netAmount, balanceAfter: wallet.balance },
        {
          userId: school._id,
          type: 'credit',
          amount: feeAmount,
          balanceAfter: schoolWallet?.balance || 0,
        },
      ],
      session,
    );

    eventBus.emit(EVENTS.PAYMENT_COMPLETED, {
      transactionId: transactions[0]._id,
      type: 'cashout',
      merchantId,
      amount: netAmount,
      feeAmount,
    });

    return { transactions, wallet, schoolWallet };
  }

  /**
   * Helper para criar ledger entries
   */
  static async createLedgerEntries(transactionId, entries, session) {
    const ledgerEntries = entries.map((entry) => ({
      transactionId,
      userId: entry.userId,
      type: entry.type,
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
    }));

    await Ledger.create(ledgerEntries, { session, ordered: true });

    // Emitir evento para cada entry
    for (const entry of ledgerEntries) {
      eventBus.emit(EVENTS.LEDGER_CREATED, entry);
    }
  }
}

export default FinancialOrchestrator;
