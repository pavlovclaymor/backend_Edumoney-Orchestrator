/**
 * Financial DTO Mapper
 * Normaliza todos os dados antes de retornar ao frontend.
 * NUNCA retorna Mongo schema direto.
 */

import { wrapSuccessResponse, wrapErrorResponse } from '../api/financial.contract.js';

/**
 * Map Wallet model to Wallet Response DTO
 */
export const toWalletResponse = (wallet) => {
  if (!wallet) return null;

  return {
    id: wallet._id?.toString() || wallet.id,
    ownerId: wallet.ownerId?.toString(),
    ownerModel: wallet.ownerModel,
    balance: Number(wallet.balance || 0),
    currency: wallet.currency || 'AOA',
    status: wallet.isFrozen ? 'frozen' : 'active',
    isFrozen: Boolean(wallet.isFrozen),
    frozenReason: wallet.frozenReason || null,
    createdAt: wallet.createdAt?.toISOString(),
    updatedAt: wallet.updatedAt?.toISOString(),
  };
};

/**
 * Map Transaction model to Transaction Response DTO
 */
export const toTransactionResponse = (transaction) => {
  if (!transaction) return null;

  return {
    id: transaction._id?.toString() || transaction.id,
    senderId: transaction.senderId?.toString(),
    senderType: transaction.senderType,
    receiverId: transaction.receiverId?.toString(),
    receiverType: transaction.receiverType,
    amount: Number(transaction.amount || 0),
    type: normalizeTransactionType(transaction.type),
    status: normalizeTransactionStatus(transaction.status),
    description: transaction.description || '',
    externalReference: transaction.externalReference || null,
    direction: transaction.direction || null,
    createdAt: transaction.createdAt?.toISOString(),
    completedAt: transaction.completedAt?.toISOString(),
  };
};

/**
 * Map Recharge model to Recharge Response DTO
 */
export const toRechargeResponse = (recharge) => {
  if (!recharge) return null;

  return {
    id: recharge._id?.toString() || recharge.id,
    userId: recharge.userId?.toString(),
    amount: Number(recharge.amount || 0),
    status: normalizeTransactionStatus(recharge.status),
    rupeReference: recharge.rupeReference || recharge.reference,
    paymentMethod: recharge.paymentMethod || 'RUPE',
    createdAt: recharge.createdAt?.toISOString(),
    completedAt: recharge.completedAt?.toISOString(),
  };
};

/**
 * Map Invoice model to Invoice Response DTO
 */
export const toInvoiceResponse = (invoice) => {
  if (!invoice) return null;

  return {
    id: invoice._id?.toString() || invoice.id,
    invoiceNumber: invoice.invoiceNumber || invoice.number,
    merchantId: invoice.merchantId?.toString(),
    merchantName: invoice.merchantName || invoice.merchant?.name || 'N/A',
    totalAmount: Number(invoice.totalAmount || 0),
    status: normalizeInvoiceStatus(invoice.status),
    items: (invoice.items || []).map((item) => ({
      description: item.description || item.name,
      quantity: item.quantity || 1,
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || item.unitPrice * item.quantity),
    })),
    clientName: invoice.clientName || null,
    clientEmail: invoice.clientEmail || null,
    rupeReference: invoice.rupeReference || null,
    isLocked: Boolean(invoice.isLocked),
    createdAt: invoice.createdAt?.toISOString(),
    paidAt: invoice.paidAt?.toISOString(),
    pdfUrl: invoice.pdfUrl || null,
  };
};

/**
 * Map Ledger Entry to Ledger Response DTO
 */
export const toLedgerEntryResponse = (entry) => {
  if (!entry) return null;

  return {
    id: entry._id?.toString() || entry.id,
    transactionId: entry.transactionId?.toString() || null,
    userId: entry.userId?.toString(),
    type: normalizeLedgerType(entry.type),
    amount: Number(entry.amount || 0),
    balanceAfter: Number(entry.balanceAfter || 0),
    metadata: entry.metadata || {},
    createdAt: entry.createdAt?.toISOString(),
  };
};

/**
 * Normalize transaction type
 */
export const normalizeTransactionType = (type) => {
  const typeMap = {
    TRANSFER: 'transfer',
    PAYMENT: 'payment',
    RECHARGE: 'recharge',
    CASHOUT: 'cashout',
    REFUND: 'refund',
    transfer: 'transfer',
    payment: 'payment',
    recharge: 'recharge',
    cashout: 'cashout',
    refund: 'refund',
  };
  return typeMap[type] || type;
};

/**
 * Normalize transaction status
 */
export const normalizeTransactionStatus = (status) => {
  const statusMap = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SUCCESS: 'success',
    COMPLETED: 'success',
    SUCCESS: 'success',
    FAILED: 'failed',
    REVERSED: 'reversed',
    pending: 'pending',
    processing: 'processing',
    success: 'success',
    completed: 'success',
    failed: 'failed',
    reversed: 'reversed',
  };
  return statusMap[status] || status;
};

/**
 * Normalize invoice status
 */
export const normalizeInvoiceStatus = (status) => {
  const statusMap = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    PAID: 'paid',
    CANCELLED: 'cancelled',
    pending: 'pending',
    processing: 'processing',
    paid: 'paid',
    cancelled: 'cancelled',
  };
  return statusMap[status] || status;
};

/**
 * Normalize ledger type
 */
export const normalizeLedgerType = (type) => {
  const typeMap = {
    CREDIT: 'credit',
    DEBIT: 'debit',
    credit: 'credit',
    debit: 'debit',
  };
  return typeMap[type] || type;
};

/**
 * Map multiple transactions
 */
export const toTransactionListResponse = (transactions, meta = {}) => {
  return wrapSuccessResponse(
    {
      items: transactions.map(toTransactionResponse),
      count: transactions.length,
    },
    meta,
  );
};

/**
 * Map multiple wallets
 */
export const toWalletListResponse = (wallets, meta = {}) => {
  return wrapSuccessResponse(
    {
      items: wallets.map(toWalletResponse),
      count: wallets.length,
    },
    meta,
  );
};

/**
 * Map multiple ledger entries
 */
export const toLedgerListResponse = (entries, meta = {}) => {
  return wrapSuccessResponse(
    {
      items: entries.map(toLedgerEntryResponse),
      count: entries.length,
    },
    meta,
  );
};

/**
 * Wrap single item response
 */
export const toSingleResponse = (data, type) => {
  const mappers = {
    wallet: toWalletResponse,
    transaction: toTransactionResponse,
    recharge: toRechargeResponse,
    invoice: toInvoiceResponse,
    ledger: toLedgerEntryResponse,
  };

  const mapper = mappers[type];
  if (!mapper) {
    return wrapSuccessResponse(data);
  }

  return wrapSuccessResponse(mapper(data));
};

export default {
  toWalletResponse,
  toTransactionResponse,
  toRechargeResponse,
  toInvoiceResponse,
  toLedgerEntryResponse,
  normalizeTransactionType,
  normalizeTransactionStatus,
  normalizeInvoiceStatus,
  normalizeLedgerType,
  toTransactionListResponse,
  toWalletListResponse,
  toLedgerListResponse,
  toSingleResponse,
};
