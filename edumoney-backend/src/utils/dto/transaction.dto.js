/**
 * Transaction DTO
 * Transforms transaction MongoDB documents to API response format
 */

import {
  toSafeObject,
  toSafeArray,
  extractId,
  toISOString,
  toSafeNumber,
  toSafeString,
} from './base.dto.js';

/**
 * Map transaction type to standard type
 */
const mapTransactionType = (type) => {
  const typeMap = {
    transfer: 'TRANSFER',
    payment: 'PAYMENT',
    recharge: 'RECHARGE',
    cashout: 'CASHOUT',
    refund: 'REFUND',
    enrollment: 'ENROLLMENT',
    school_fee: 'SCHOOL_FEE',
    certificate: 'CERTIFICATE',
  };
  return typeMap[type] || toSafeString(type).toUpperCase();
};

/**
 * Map transaction status to standard status
 */
const mapTransactionStatus = (status) => {
  const statusMap = {
    pending: 'PENDING',
    processing: 'PROCESSING',
    success: 'SUCCESS',
    completed: 'SUCCESS',
    failed: 'FAILED',
    cancelled: 'CANCELLED',
    reversed: 'REVERSED',
  };
  return statusMap[status] || toSafeString(status).toUpperCase();
};

/**
 * Determine transaction direction
 */
const mapDirection = (transaction) => {
  if (transaction.direction) return transaction.direction;

  // Auto-determine based on type
  const creditTypes = ['recharge', 'refund', 'enrollment'];
  if (creditTypes.includes(transaction.type)) return 'incoming';

  const debitTypes = ['transfer', 'payment', 'cashout', 'school_fee'];
  if (debitTypes.includes(transaction.type)) return 'outgoing';

  return 'unknown';
};

/**
 * Transaction DTO
 */
export const TransactionDTO = {
  /**
   * Transform single transaction
   */
  fromDocument: (transaction) => {
    if (!transaction) return null;

    const obj = toSafeObject(transaction);
    if (!obj) return null;

    return {
      id: extractId(obj),
      senderId: obj.senderId,
      senderType: toSafeString(obj.senderType),
      receiverId: obj.receiverId,
      receiverType: toSafeString(obj.receiverType),
      amount: toSafeNumber(obj.amount),
      type: mapTransactionType(obj.type),
      status: mapTransactionStatus(obj.status),
      direction: mapDirection(obj),
      description: toSafeString(obj.description),
      externalReference: toSafeString(obj.externalReference, null),
      metadata: obj.metadata || null,
      createdAt: toISOString(obj.createdAt),
      completedAt: toISOString(obj.completedAt),
      failedAt: toISOString(obj.failedAt),
    };
  },

  /**
   * Transform transaction for list (minimal data)
   */
  forList: (transaction) => {
    if (!transaction) return null;

    return {
      id: extractId(transaction),
      amount: toSafeNumber(transaction.amount),
      type: mapTransactionType(transaction.type),
      status: mapTransactionStatus(transaction.status),
      direction: mapDirection(transaction),
      description: toSafeString(transaction.description),
      createdAt: toISOString(transaction.createdAt),
    };
  },

  /**
   * Transform transaction for detail (full data)
   */
  forDetail: (transaction) => {
    if (!transaction) return null;

    const dto = TransactionDTO.fromDocument(transaction);
    if (!dto) return null;

    return {
      ...dto,
      // Additional detail fields
      canRetry: transaction.status === 'failed',
      canReverse: transaction.status === 'completed',
      retryCount: toSafeNumber(transaction.retryCount, 0),
    };
  },

  /**
   * Transform array of transactions
   */
  fromArray: (transactions) => toSafeArray(transactions).map(TransactionDTO.fromDocument),

  /**
   * Transform array for list view
   */
  fromArrayForList: (transactions) => toSafeArray(transactions).map(TransactionDTO.forList),
};

export default TransactionDTO;
