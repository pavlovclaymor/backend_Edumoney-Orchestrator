import Merchant from '../models/merchant.model.js';
import Transaction from '../models/transaction.js';
import Wallet from '../models/wallet.js';
import mongoose from 'mongoose';
import School from '../models/school.model.js';

import { processPayment } from '../utils/payments.utils.js';
import { validateAngolaIBAN } from '../utils/ibanValidator.js';
import { FinancialOrchestrator, TRANSACTION_TYPE } from '../core/index.js';

import { createNotification } from './notification.controller.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

export const createCashout = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { amount, bankAccount } = req.body;
    const merchantId = req.user?._id;

    if (!merchantId || !amount || !bankAccount)
      throw Object.assign(new Error('Dados inválidos'), { status: 400 });

    if (!validateAngolaIBAN(bankAccount))
      throw Object.assign(new Error('IBAN inválido'), { status: 400 });
    if (amount <= 0) throw Object.assign(new Error('Valor inválido'), { status: 400 });

    // Comerciante
    const merchant = await Merchant.findById(merchantId).session(session);
    if (!merchant) throw Object.assign(new Error('Comerciante não encontrado'), { status: 404 });

    // Escola
    const school = await School.findById(merchant.schoolId).session(session);
    if (!school) throw Object.assign(new Error('Escola não encontrada'), { status: 404 });

    // Carteira do comerciante
    const wallet = await Wallet.findOne({
      ownerId: merchantId,
      ownerModel: 'Merchant',
    }).session(session);
    if (!wallet) throw Object.assign(new Error('Carteira não encontrada'), { status: 404 });
    if (wallet.balance < amount)
      throw Object.assign(new Error('Saldo insuficiente'), { status: 400 });

    // Fee da escola
    const feePercent = school.feeRate || 0;
    const feeAmount = amount * feePercent;
    const netAmount = amount - feeAmount;

    // Pagamento externo (valor líquido)
    const paymentResponse = await processPayment({
      from: 'Edumoney_System',
      to: bankAccount,
      amount: netAmount,
    });
    if (!paymentResponse.success)
      throw Object.assign(new Error('Erro no gateway de pagamento'), { status: 500 });

    // MIGRADO: Usar FinancialOrchestrator para operações financeiras
    // OBS: O Orchestrator já cria as Transactions necessárias para audit trail
    await FinancialOrchestrator.execute({
      type: TRANSACTION_TYPE.CASHOUT,
      payload: {
        merchantId,
        amount,
        bankAccount,
        feeAmount,
        feeRecipientId: school._id,
        feePercent,
      },
      session,
    });

    // ✅ REMOVIDO: Transactions manuais - Orchestrator já cria audit trail completo
    // ❌ ANTES: await Transaction.create([...]) - BYPASS
    // ✅ AGORA: FinancialOrchestrator.handleCashout() cria todas as transactions

    await session.commitTransaction();
    session.endSession();

    await createNotification(
      merchantId,
      'Merchant',
      `Levantamento realizado - ${netAmount} Kz`,
      `Levantamento realizado para a conta: ${merchant.iban}`,
      'transaction',
      'high',
      null,
      'Transaction',
    );

    await createNotification(
      school._id,
      'School',
      `Entrada de valores - ${feeAmount} Kz`,
      `Transferido pelo comerciante: ${merchant.name} (Fee: ${feePercent}%)`,
      'transaction',
      'low',
      null,
      'Transaction',
    );

    await writeAuditLog({
      userId: merchantId,
      userModel: 'Merchant',
      action: 'CASHOUT_CREATED',
      entity: 'Transaction',
      entityId: null,
      status: 'success',
      schoolId: school._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { amount, feeAmount, netAmount },
    }).catch(() => {});

    // Apply DTO transformation
    const dto = {
      success: true,
      netAmount,
      feeAmount,
      feePercent,
      newBalance: wallet.balance,
      bankAccount: bankAccount.slice(-4).padStart(bankAccount.length, '*'),
    };

    return res.status(200).json(ApiResponse.success(dto, 'Levantamento realizado com sucesso'));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    const status = err.status || 500;
    return res.status(status).json(ErrorResponse.badRequest(err.message));
  }
};
