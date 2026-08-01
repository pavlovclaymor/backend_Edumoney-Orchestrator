import Invoice from '../models/invoice.model.js';
import Product from '../models/Produt.model.js';
import Transaction from '../models/transaction.js';

import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

import { generateInvoicePDF } from './pdf.service.js';
import { generateRUPE } from '../utils/rupeSimulator.js';
import Counter from '../models/Counter.model.js';
import { getIO } from '../socket/index.js';
import { canGeneratePdf } from '../utils/invoiceRules.js';
import QRCode from 'qrcode';
import { FinancialOrchestrator, TRANSACTION_TYPE } from '../core/index.js';

/* ===============================
   Generate invoice number
================================= */
export const generateInvoiceNumber = async (merchantId) => {
  const counter = await Counter.findOneAndUpdate(
    { merchantId, name: 'invoice' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `INV-${String(counter.seq).padStart(6, '0')}`;
};

/* ===============================
   CREATE INVOICE SERVICE
================================= */
export const createInvoiceservice = async (data) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      schoolId,
      merchantId,
      clientName,
      clientEmail,
      items,
      discountAmount = 0,
      paymentMethod = 'WALLET',
    } = data;

    if (!items || items.length === 0) throw new Error('Invoice must have at least one item.');

    const productIds = items.map((i) => i.productId);

    const products = await Product.find({
      _id: { $in: productIds },
      merchantId,
    }).session(session);

    if (products.length !== items.length) throw new Error('Some products not found');

    const formattedItems = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.productId);

      if (!product) throw new Error('Produto não encontrado');
      if (product.quantity < item.quantity) throw new Error('Estoque insuficiente');

      return {
        productId: product._id,
        description: product.name,
        quantity: item.quantity,
        price: product.price,
        subtotal: product.price * item.quantity,
      };
    });

    const subtotalAmount = formattedItems.reduce((acc, item) => acc + item.subtotal, 0);

    const totalAmount = subtotalAmount - discountAmount;

    if (totalAmount < 0) throw new Error('Discount inválido');

    const invoiceNumber = await generateInvoiceNumber(merchantId);

    const isCash = paymentMethod === 'CASH';

    /* =========================
       RUPE LOGIC (TRANSFER FLOW)
    ========================== */
    let rupeReference = null;
    let rupeExpiresAt = null;
    let rupeStatus = null;

    if (!isCash) {
      rupeReference = generateRUPE();
      rupeExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      rupeStatus = 'pending';
    }

    /* =========================
       CREATE INVOICE
    ========================== */
    const [invoice] = await Invoice.create(
      [
        {
          schoolId,
          merchantId,
          invoiceNumber,
          clientName,
          clientEmail,
          items: formattedItems,
          subtotalAmount,
          discountAmount,
          totalAmount,
          paymentMethod,

          status: isCash ? 'paid' : 'pending',
          paymentStatus: isCash ? 'paid' : 'unpaid',
          paidAt: isCash ? new Date() : null,
          isLocked: isCash,

          rupeReference,
          rupeExpiresAt,
          rupeStatus,
        },
      ],
      { session },
    );

    /* =========================
       QR CODE GENERATION
    ========================== */
    if (!isCash) {
      try {
        const qrData = `PAY:${invoice._id}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData);
        invoice.qrCode = qrCodeDataUrl;
        await invoice.save({ session });
      } catch (qrErr) {
        console.error('Erro ao gerar QR Code para invoice:', qrErr);
      }
    }

    /* =========================
       UPDATE STOCK
    ========================== */
    const bulkOps = formattedItems.map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $inc: { quantity: -item.quantity } },
      },
    }));

    await Product.bulkWrite(bulkOps, { session });

    /* =========================
       FINANCIAL TRANSACTION
    ========================== */
    // ✅ MIGRADO: Usar FinancialOrchestrator para operações financeiras
    // O Orchestrator garante atomicidade, ledger e audit trail
    await FinancialOrchestrator.execute({
      type: TRANSACTION_TYPE.INVOICE_CREATION,
      payload: {
        merchantId,
        userId: data.studentId || data.userId,
        amount: totalAmount,
        invoiceId: invoice._id,
        paymentMethod,
        status: isCash ? 'completed' : 'pending',
      },
      session,
    });

    await session.commitTransaction();
    session.endSession();

    /* =========================
       SOCKET: INVOICE CREATED
    ========================== */
    try {
      const io = getIO();

      if (!isCash) {
        io.to(merchantId.toString()).emit('invoice:created', {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          rupeReference: invoice.rupeReference,
          amount: invoice.totalAmount,
          status: 'pending',
          qrCode: invoice.qrCode,
        });
      }
    } catch (err) {
      console.error('Socket error on invoice creation:', err);
    }

    /* =========================
       PDF (ONLY CASH)
    ========================== */
    if (isCash && invoice.status === 'paid') {
      (async () => {
        try {
          const pdfPath = await generateInvoicePDF(invoice);
          invoice.pdfUrl = pdfPath;
          await invoice.save();
        } catch (err) {
          invoice.pdfFailed = true;
          await invoice.save();
        }
      })();
    }

    return invoice;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/* ===============================
   PDF recovery system
================================= */
export const generateMissingPDFs = async () => {
  const invoices = await Invoice.find({
    $or: [{ pdfUrl: null }, { pdfFailed: true }],
  });

  for (const invoice of invoices) {
    try {
      if (!canGeneratePdf(invoice)) continue;

      const pdfPath = await generateInvoicePDF(invoice);
      invoice.pdfUrl = pdfPath;
      invoice.pdfFailed = false;
      await invoice.save();
    } catch (error) {
      invoice.pdfFailed = true;
      await invoice.save();
      console.error('PDF error:', invoice.invoiceNumber, error);
    }
  }
};

/* ===============================
   Get invoice PDF path
================================= */
export const getInvoicePDFPath = (merchantId, invoiceNumber) => {
  const filePath = path.join(
    process.cwd(),
    'uploads',
    'invoice',
    merchantId.toString(),
    `${invoiceNumber}.pdf`,
  );

  if (!fs.existsSync(filePath)) {
    throw new Error('PDF não encontrado');
  }

  return filePath;
};

/* ===============================
   Obter vendas do dia
================================= */
export const getTodaySales = async (merchantId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const invoices = await Invoice.find({
    merchantId,
    status: 'paid',
    paidAt: { $gte: startOfDay },
  }).sort({ paidAt: -1 });

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  return { totalAmount, count: invoices.length, invoices };
};

/* ===============================
   Obter vendas da semana
================================= */
export const getWeeklySales = async (merchantId) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  const invoices = await Invoice.find({
    merchantId,
    status: 'paid',
    paidAt: { $gte: startOfWeek },
  }).sort({ paidAt: 1 });

  const dailySales = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    dailySales[dateStr] = { date: dateStr, amount: 0, count: 0 };
  }

  invoices.forEach((inv) => {
    const dateStr = inv.paidAt.toISOString().split('T')[0];
    if (dailySales[dateStr]) {
      dailySales[dateStr].amount += inv.totalAmount || 0;
      dailySales[dateStr].count += 1;
    }
  });

  const totalAmount = Object.values(dailySales).reduce((sum, day) => sum + day.amount, 0);

  return { dailySales: Object.values(dailySales), totalAmount };
};

/* ===============================
   Obter todas as vendas
================================= */
export const getAllSales = async (merchantId) => {
  const invoices = await Invoice.find({
    merchantId,
    status: 'paid',
  }).sort({ paidAt: -1 });

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  return { totalAmount, count: invoices.length, invoices };
};

/* ===============================
   Obter PDF da invoice
================================= */
export const getInvoicePDFById = async (invoiceId) => {
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    throw Object.assign(new Error('ID inválido'), { status: 400 });
  }

  console.log(invoiceId);

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw Object.assign(new Error('Invoice não encontrada'), { status: 404 });
  }

  if (!canGeneratePdf(invoice)) {
    throw Object.assign(new Error('PDF não disponível para invoices pendentes'), { status: 400 });
  }

  if (invoice.pdfUrl) {
    return invoice.pdfUrl;
  }

  const pdf = await generateInvoicePDF(invoice);
  invoice.pdfUrl = pdf;
  await invoice.save();

  return pdf;
};

/* ===============================
   Confirmar pagamento de invoice
================================= */
export const confirmInvoicePayment = async (invoiceId, studentId, studentName, studentEmail) => {
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    throw Object.assign(new Error('ID inválido'), { status: 400 });
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw Object.assign(new Error('Invoice não encontrada'), { status: 404 });
  }

  if (invoice.status === 'paid') {
    throw Object.assign(new Error('Invoice já foi paga'), { status: 400 });
  }

  if (invoice.status === 'processing') {
    throw Object.assign(new Error('Invoice está em processamento'), { status: 409 });
  }

  invoice.status = 'paid';
  invoice.paidAt = new Date();
  invoice.isLocked = true;
  invoice.studentId = studentId;
  invoice.clientName = studentName;
  invoice.clientEmail = studentEmail;

  await invoice.save();

  try {
    const pdf = await generateInvoicePDF(invoice);
    invoice.pdfUrl = pdf;
    await invoice.save();

    const io = getIO();
    io.to(invoice.merchantId.toString()).emit('invoice:pdf_ready', {
      invoiceId: invoice._id,
      pdfUrl: pdf,
    });
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
  }

  return invoice;
};

/* ===============================
   Obter invoice por ID
================================= */
export const getInvoiceById = async (invoiceId) => {
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    throw Object.assign(new Error('ID inválido'), { status: 400 });
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw Object.assign(new Error('Invoice não encontrada'), { status: 404 });
  }

  return invoice;
};
