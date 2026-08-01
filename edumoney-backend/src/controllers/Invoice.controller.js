/**
 * Invoice Controller
 * Delega toda a lógica de negócio para invoice.service.js
 * CRÍTICO: Módulo financeiro - requer testes rigorosos.
 *
 * Uses Contract-First pattern:
 * - DTO for data transformation
 * - ResponseWrapper for standardization
 */

import * as invoiceService from '../services/invoice.service.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { InvoiceDTO } from '../utils/dto/index.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// =========================================================
// CRIAR INVOICE
// =========================================================
export const createInvoice = async (req, res) => {
  try {
    const merchantId = req.user?._id;
    const { schoolId, clientName, clientEmail, items, discountAmount, paymentMethod } = req.body;

    const invoice = await invoiceService.createInvoiceservice({
      schoolId,
      merchantId,
      clientName,
      clientEmail,
      items,
      discountAmount,
      paymentMethod,
    });

    await writeAuditLog({
      userId: merchantId,
      userModel: 'Merchant',
      action: 'INVOICE_CREATED',
      entity: 'Invoice',
      entityId: invoice._id,
      status: 'success',
      schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { invoiceNumber: invoice.invoiceNumber, amount: invoice.totalAmount },
    }).catch(() => {});

    // Apply DTO transformation
    const dto = InvoiceDTO.fromDocument(invoice);

    return res.status(201).json(ApiResponse.created(dto, 'Invoice criada com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 400
        ? ErrorResponse.badRequest(error.message)
        : status === 404
          ? ErrorResponse.notFound('Escola')
          : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// VENDAS DO DIA
// =========================================================
export const getTodaySales = async (req, res) => {
  try {
    const merchantId = req.user?._id;
    const result = await invoiceService.getTodaySales(merchantId);

    // Apply DTO transformation
    const dto = {
      ...result,
      invoices: result.invoices ? InvoiceDTO.fromArray(result.invoices) : [],
    };

    return res.status(200).json(ApiResponse.success(dto, 'Vendas do dia'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// VENDAS DA SEMANA
// =========================================================
export const getWeeklySales = async (req, res) => {
  try {
    const merchantId = req.user?._id;
    const result = await invoiceService.getWeeklySales(merchantId);

    // Apply DTO transformation
    const dto = {
      ...result,
      invoices: result.invoices ? InvoiceDTO.fromArray(result.invoices) : [],
    };

    return res.status(200).json(ApiResponse.success(dto, 'Vendas da semana'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// TODAS AS VENDAS
// =========================================================
export const getAllSales = async (req, res) => {
  try {
    const merchantId = req.user?._id;
    const result = await invoiceService.getAllSales(merchantId);

    // Apply DTO transformation
    const dto = {
      ...result,
      invoices: result.invoices ? InvoiceDTO.fromArray(result.invoices) : [],
    };

    return res.status(200).json(ApiResponse.success(dto, 'Todas as vendas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// =========================================================
// OBTER PDF DA INVOICE
// =========================================================
export const getInvoicePDF = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const pdfUrl = await invoiceService.getInvoicePDFById(invoiceId);

    return res.status(200).json(ApiResponse.success({ pdfUrl }, 'PDF gerado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Invoice') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// CONFIRMAR PAGAMENTO DE INVOICE
// =========================================================
export const confirmInvoicePayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { studentId, studentName, studentEmail } = req.body;

    const invoice = await invoiceService.confirmInvoicePayment(
      invoiceId,
      studentId,
      studentName,
      studentEmail,
    );

    await writeAuditLog({
      userId: studentId,
      userModel: 'User',
      action: 'INVOICE_PAYMENT_CONFIRMED',
      entity: 'Invoice',
      entityId: invoice._id,
      status: 'success',
      schoolId: req.user.schoolId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { amount: invoice.totalAmount, invoiceNumber: invoice.invoiceNumber },
    }).catch(() => {});

    // Apply DTO transformation
    const dto = InvoiceDTO.fromDocument(invoice);

    return res.status(200).json(ApiResponse.success(dto, 'Pagamento confirmado com sucesso'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Invoice') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};

// =========================================================
// OBTER INVOICE POR ID
// =========================================================
export const getInvoiceById = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await invoiceService.getInvoiceById(invoiceId);

    // Apply DTO transformation
    const dto = InvoiceDTO.fromDocument(invoice);

    return res.status(200).json(ApiResponse.success(dto, 'Invoice encontrada'));
  } catch (error) {
    const status = error.status || 500;
    const errResponse =
      status === 404 ? ErrorResponse.notFound('Invoice') : ErrorResponse.internal(error.message);
    return res.status(status).json(errResponse);
  }
};
