/**
 * ============================================
 * PAYMENT SERVICE (MIGRATED)
 * ============================================
 *
 * Bank-Grade Financial System - Single Source of Truth
 *
 * MIGRATION STATUS: ✅ COMPLETE
 * All financial operations now use FinancialOrchestrator
 */

import mongoose from 'mongoose';
import Wallet from '../models/wallet.js';
import School from '../models/school.model.js';
import Rupe from '../models/rupe.model.js';
import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
import Transaction from '../models/transaction.js';
import ServicePrice from '../models/servicePrice.model.js';
import Merchant from '../models/merchant.model.js';
import Invoice from '../models/invoice.model.js';
import Ledger from '../models/ledger.model.js';
import { generateInvoicePDF } from './pdf.service.js';
import crypto from 'crypto';
import { emitPaymentEvents } from '../utils/emitPaymentEvents.js';
import { FinancialOrchestrator, TRANSACTION_TYPE } from '../core/index.js';

const SERVICE_TYPE = {
  CERTIFICATE: 'CERTIFICADO',
  EXAM_SHEET: 'FOLHA_PROVA',
};

const generateReference = (prefix = 'TX') => {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
};

/**
 * Aplicar métricas de serviço da escola
 */
const applySchoolServiceMetrics = (school, rupe) => {
  school.requestDocument(rupe.quantidade);

  if (rupe.tipoServico === SERVICE_TYPE.CERTIFICATE) {
    school.incrementCertificateRequests(rupe.quantidade);
  }

  if (rupe.tipoServico === SERVICE_TYPE.EXAM_SHEET) {
    school.sellSheets(rupe.quantidade);
  }
};

/**
 * Validar PIN do estudante
 */
export const validateStudentPin = async (userId, pin, session = null) => {
  const query = User.findById(userId).select('+pin');
  if (session) query.session(session);

  const student = await query;
  if (!student) {
    throw Object.assign(new Error('Estudante não encontrado'), { status: 404 });
  }

  const isMatch = await bcrypt.compare(pin, student.pin);
  if (!isMatch) {
    throw Object.assign(new Error('PIN incorreto'), { status: 401 });
  }

  return student;
};

/**
 * PROCESSAR PAGAMENTO DE INVOICE (makePayment)
 * MIGRADO: Usa FinancialOrchestrator para operações financeiras
 */
export const processInvoicePayment = async ({ userId, rupeReference, session }) => {
  // LOCK ATÓMICO
  let invoice;

  if (!mongoose.Types.ObjectId.isValid(rupeReference)) {
    invoice = await Invoice.findOneAndUpdate(
      { rupeReference, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true, session },
    );
  } else {
    invoice = await Invoice.findOneAndUpdate(
      { _id: rupeReference, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true, session },
    );
  }

  if (!invoice) {
    throw Object.assign(new Error('Invoice não encontrada, já paga ou em processamento'), {
      status: 409,
    });
  }

  const wallet = await Wallet.findOne({
    ownerId: userId,
    ownerModel: 'User',
  }).session(session);

  if (!wallet) {
    throw Object.assign(new Error('Carteira não encontrada'), { status: 404 });
  }

  if (wallet.balance < invoice.totalAmount) {
    throw Object.assign(new Error('Saldo insuficiente'), { status: 400 });
  }

  // MIGRADO: Usar FinancialOrchestrator para operações de pagamento
  await FinancialOrchestrator.execute({
    type: TRANSACTION_TYPE.INVOICE_PAYMENT,
    payload: {
      userId,
      invoiceId: invoice._id,
      merchantId: invoice.merchantId,
      amount: invoice.totalAmount,
      description: `Pagamento da invoice ${invoice.invoiceNumber}`,
    },
    session,
  });

  invoice.status = 'paid';
  invoice.paidAt = new Date();
  invoice.isLocked = true;
  invoice.studentId = userId;

  const user = await User.findById(userId).session(session);
  if (user) {
    invoice.clientName = user.name;
    invoice.clientEmail = user.email;
  }

  await invoice.save({ session });

  // A transação e ledger são criados pelo Orchestrator
  return { invoice, success: true };
};

/**
 * PROCESSAR PAGAMENTO PARA ESCOLA (payToSchool)
 * MIGRADO: Usa FinancialOrchestrator para operações financeiras
 */
export const processSchoolPayment = async ({ userId, rupeReference, session }) => {
  const rupe = await Rupe.findOne({
    referencia: rupeReference,
    estado: 'PENDENTE',
  }).session(session);

  if (!rupe) {
    throw Object.assign(new Error('RUPE não encontrado ou já processado'), { status: 409 });
  }

  const serviceConfig = await ServicePrice.findOne({
    schoolId: rupe.schoolId,
    tipoServico: rupe.tipoServico,
  }).session(session);

  if (!serviceConfig || !serviceConfig.active) {
    throw Object.assign(new Error('Serviço desativado. O pagamento não pode ser processado.'), {
      status: 403,
    });
  }

  const school = await School.findById(rupe.schoolId).session(session);
  const student = await User.findById(userId).session(session);

  if (!school || !student) {
    throw Object.assign(new Error('Dados inválidos'), { status: 404 });
  }

  // MIGRADO: Usar FinancialOrchestrator para School Payment
  const result = await FinancialOrchestrator.execute({
    type: TRANSACTION_TYPE.SCHOOL_PAYMENT,
    payload: {
      senderId: userId,
      receiverId: school._id,
      amount: rupe.valor,
      description: 'Pagamento escola',
      externalReference: generateReference('SCHOOL'),
    },
    session,
  });

  await Rupe.findByIdAndUpdate(rupe._id, { estado: 'PAGO' }, { session });

  applySchoolServiceMetrics(school, rupe);
  await school.save({ session });

  return { transaction: result.transaction, school, student };
};

/**
 * CORE: LOGIC DE PAGAMENTO DE INVOICE (makeInvoicePaymentLogic)
 * MIGRADO: Usa FinancialOrchestrator para operações financeiras
 */
export const makeInvoicePaymentLogic = async ({
  userId,
  rupeReference,
  session,
  auditContext = {},
}) => {
  let invoice;

  if (!mongoose.Types.ObjectId.isValid(rupeReference)) {
    invoice = await Invoice.findOneAndUpdate(
      { rupeReference, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true, session },
    );
  } else {
    invoice = await Invoice.findOneAndUpdate(
      { _id: rupeReference, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true, session },
    );
  }

  if (!invoice) {
    throw Object.assign(new Error('Factura não encontrada'), { status: 404 });
  }

  const user = await User.findById(userId).session(session);
  const merchant = await Merchant.findById(invoice.merchantId).session(session);

  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  }

  // MIGRADO: Usar FinancialOrchestrator para Invoice Payment
  const result = await FinancialOrchestrator.execute({
    type: TRANSACTION_TYPE.INVOICE_PAYMENT,
    payload: {
      senderId: userId,
      receiverId: invoice.merchantId,
      amount: invoice.totalAmount,
      description: `Pagamento da Factura ${invoice.invoiceNumber} do comerciante: ${merchant?.name || 'N/A'}`,
      externalReference: generateReference('INV'),
    },
    session,
  });

  invoice.status = 'paid';
  invoice.clientName = user.name || 'Cliente';
  invoice.clientEmail = user.email || '-';
  await invoice.save({ session });

  await generateInvoicePDF(invoice);

  return { transaction: result.transaction, receiverId: invoice.merchantId, invoice };
};

/**
 * CORE: LOGIC DE QR PAYMENT
 * MIGRADO: Usa FinancialOrchestrator para operações financeiras
 */
export const qrPaymentLogic = async ({ userId, extra, session, auditContext = {} }) => {
  const { merchantId, amount } = extra;
  const student = await User.findById(userId).session(session);

  // MIGRADO: Usar FinancialOrchestrator para QR Payment
  const result = await FinancialOrchestrator.execute({
    type: TRANSACTION_TYPE.QR_PAYMENT,
    payload: {
      senderId: userId,
      receiverId: merchantId,
      amount,
      description: 'QR Payment',
      externalReference: generateReference('QR'),
    },
    session,
  });

  return { transaction: result.transaction, receiverId: merchantId, student };
};

/**
 * EXECUTAR PAGAMENTO (executePayment)
 */
export const executePaymentLogic = async ({
  userId,
  type,
  rupeReference,
  pin,
  extra,
  session,
  auditContext = {},
}) => {
  // Validar PIN
  const user = await User.findById(userId).select('+pin').session(session);
  const isMatch = await bcrypt.compare(pin, user.pin);
  if (!isMatch) {
    throw Object.assign(new Error('PIN inválido'), { status: 401 });
  }

  let result;

  if (type === 'SCHOOL') {
    result = await processSchoolPayment({ userId, rupeReference, session });
  } else if (type === 'INVOICE') {
    result = await makeInvoicePaymentLogic({
      userId,
      rupeReference,
      session,
      auditContext,
    });
  } else if (type === 'QR') {
    result = await qrPaymentLogic({ userId, extra, session, auditContext });
  } else {
    throw Object.assign(new Error('Tipo inválido'), { status: 400 });
  }

  return result;
};

/**
 * Gerar PDF da invoice (async, chamado após commit)
 */
export const generateInvoicePdfAsync = async (invoice) => {
  try {
    const pdf = await generateInvoicePDF(invoice);
    invoice.pdfUrl = pdf;
    await invoice.save();
    return pdf;
  } catch (err) {
    console.error('PDF error:', err);
    return null;
  }
};

/**
 * Emitir eventos de pagamento via socket
 */
export const emitPaymentEventsAsync = ({ senderId, receiverId, transaction }) => {
  try {
    emitPaymentEvents({
      senderId,
      receiverId,
      transaction,
    });
  } catch (err) {
    console.error('Socket error:', err);
  }
};
