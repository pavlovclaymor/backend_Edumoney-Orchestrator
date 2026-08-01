/**
 * Payment Controller
 * Delega toda a lógica de negócio para payment.service.js
 * CRÍTICO: Módulo financeiro - requer testes rigorosos.
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import mongoose from 'mongoose';
import * as paymentService from '../services/payment.service.js';
import { createNotification } from './notification.controller.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getIO } from '../services/socket.service.js';
import { InvoiceDTO, TransactionDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// =========================================================
// PAGAMENTO DE INVOICE (makePayment)
// =========================================================
export const makePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { rupeReference, pin } = req.body;
    const studentId = req.user?._id;

    if (!studentId || !rupeReference || !pin) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json(ErrorResponse.badRequest('Dados incompletos'));
    }

    // Validar PIN
    const student = await paymentService.validateStudentPin(studentId, pin, session);

    // Processar pagamento
    const invoice = await paymentService.processInvoicePayment({
      userId: studentId,
      rupeReference,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    // Gerar PDF (async após commit)
    (async () => {
      try {
        const pdf = await paymentService.generateInvoicePdfAsync(invoice);
        if (pdf) {
          const io = getIO();
          io.to(invoice.merchantId.toString()).emit('invoice:pdf_ready', {
            invoiceId: invoice._id,
            pdfUrl: pdf,
          });
        }
      } catch (err) {
        console.error('PDF error:', err);
      }
    })();

    // Notificações
    await createNotification(
      invoice.merchantId,
      'Merchant',
      'Fatura paga com sucesso',
      `A invoice ${invoice.invoiceNumber} foi paga no valor de ${invoice.totalAmount} AOA`,
      'transaction',
      'high',
      invoice._id,
      'Invoice',
    );

    await createNotification(
      studentId,
      'User',
      'Pagamento efetuado com sucesso',
      `A sua fatura ${invoice.invoiceNumber} foi paga no valor de ${invoice.totalAmount} AOA`,
      'info',
      'low',
      invoice._id,
      'Invoice',
    );

    // Socket events
    try {
      const io = getIO();
      io.to(studentId.toString()).emit('payment:invoice_paid', {
        invoiceId: invoice._id,
        amount: invoice.totalAmount,
      });
      io.to(invoice.merchantId.toString()).emit('payment:invoice_paid', {
        invoiceId: invoice._id,
        amount: invoice.totalAmount,
      });
      io.to(invoice.merchantId.toString()).emit('invoice:paid', {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
        studentId,
      });
      io.to(studentId.toString()).emit('wallet:updated');
      io.to(invoice.merchantId.toString()).emit('wallet:updated');
    } catch (socketErr) {
      console.error('Socket error:', socketErr);
    }

    // Audit
    await writeAuditLog({
      userId: studentId,
      userModel: 'User',
      action: 'INVOICE_PAYMENT_SUCCESS',
      entity: 'Invoice',
      entityId: invoice._id,
      status: 'success',
      schoolId: student.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { amount: invoice.totalAmount, invoiceNumber: invoice.invoiceNumber },
    }).catch(() => {});

    // Apply DTO transformation
    const dto = InvoiceDTO.forStudent(invoice);

    return res
      .status(200)
      .json(ApiResponse.success(dto, 'Pagamento da invoice realizado com sucesso'));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : status === 401
          ? ErrorResponse.unauthorized(error.message)
          : status === 404
            ? ErrorResponse.notFound('Invoice')
            : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// PAGAMENTO PARA ESCOLA (payToSchool)
// =========================================================
export const payToSchool = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { rupeReference, pin } = req.body;
    const studentId = req.user?._id;

    if (!studentId || !rupeReference || !pin) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json(ErrorResponse.badRequest('Dados incompletos'));
    }

    // Validar PIN
    const student = await paymentService.validateStudentPin(studentId, pin, session);

    // Processar pagamento
    const { transaction, school } = await paymentService.processSchoolPayment({
      userId: studentId,
      rupeReference,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    // Notificações
    await createNotification(
      school._id,
      'School',
      'Pagamento recebido',
      `Recebeste ${transaction.amount} KZ pelo serviço`,
      'transaction',
      'high',
      transaction._id,
      'Transaction',
    );

    await createNotification(
      studentId,
      'User',
      'Pagamento realizado',
      `Pagaste ${transaction.amount} KZ para a escola`,
      'info',
      'low',
      transaction._id,
      'Transaction',
    );

    // Audit
    await writeAuditLog({
      userId: studentId,
      userModel: 'User',
      action: 'RUPE_PURCHASED',
      entity: 'Transaction',
      entityId: transaction._id,
      status: 'success',
      schoolId: school._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { amount: transaction.amount, rupeReference },
    }).catch(() => {});

    // Apply DTO transformation
    const dto = TransactionDTO.fromDocument(transaction);

    return res.status(200).json(ApiResponse.success(dto, 'Pagamento realizado com sucesso'));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : status === 401
          ? ErrorResponse.unauthorized(error.message)
          : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// EXECUTAR PAGAMENTO (executePayment)
// =========================================================
export const executePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { type, rupeReference, pin, extra } = req.body;
    const userId = req.user?._id;

    if (!type || !pin) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json(ErrorResponse.badRequest('Dados incompletos'));
    }

    const auditContext = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const result = await paymentService.executePaymentLogic({
      userId,
      type,
      rupeReference,
      pin,
      extra,
      session,
      auditContext,
    });

    await session.commitTransaction();
    session.endSession();

    // Socket centralizado
    paymentService.emitPaymentEventsAsync({
      senderId: userId,
      receiverId: result.receiverId,
      transaction: result.transaction,
    });

    // Notificações para INVOICE
    if (type === 'INVOICE' && result.invoice) {
      await createNotification(
        result.receiverId,
        'Merchant',
        'Pagamento recebido',
        `Recebeste ${result.invoice.totalAmount} KZ pela invoice ${result.invoice.invoiceNumber}`,
        'transaction',
        'high',
        result.transaction._id,
        'Transaction',
      );

      await createNotification(
        userId,
        'User',
        'Pagamento realizado',
        `Pagaste ${result.invoice.totalAmount} KZ pela invoice ${result.invoice.invoiceNumber}`,
        'info',
        'low',
        result.transaction._id,
        'Transaction',
      );

      await writeAuditLog({
        userId,
        userModel: 'User',
        action: 'PAGAMENT_DE_FACTURA',
        entity: 'FACTURA',
        entityId: result.invoice._id,
        status: 'success',
        schoolId: req.user.schoolId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          amount: result.invoice.totalAmount,
          invoiceNumber: result.invoice.invoiceNumber,
        },
      }).catch(() => {});
    }

    // Notificações para QR
    if (type === 'QR') {
      await createNotification(
        result.receiverId,
        'Merchant',
        'Pagamento recebido',
        `Recebeste ${extra.amount} KZ pelo pagamento QR`,
        'transaction',
        'high',
        result.transaction._id,
        'Transaction',
      );

      await writeAuditLog({
        userId,
        userModel: 'User',
        action: 'QR_PAYMENT_MADE',
        entity: 'Transaction',
        entityId: result.transaction._id,
        status: 'success',
        schoolId: result.student?.schoolId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { amount: extra.amount, merchantId: extra.merchantId },
      }).catch(() => {});
    }

    // Apply DTO transformation
    const dto = {
      transaction: result.transaction ? TransactionDTO.fromDocument(result.transaction) : null,
      invoice: result.invoice ? InvoiceDTO.fromDocument(result.invoice) : null,
      receiverId: result.receiverId,
    };

    return res.status(200).json(ApiResponse.success(dto, 'Pagamento realizado com sucesso'));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : status === 401
          ? ErrorResponse.unauthorized(error.message)
          : status === 404
            ? ErrorResponse.notFound('Recurso')
            : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};
