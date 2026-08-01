/**
 * Payment DTO
 * Transforms payment MongoDB documents to API response format
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
 * Transform payment document to DTO
 * @param {Object} payment - Payment MongoDB document
 * @returns {Object} Payment DTO
 */
export const PaymentDTO = {
  fromDocument: (payment) => {
    if (!payment) return null;

    const obj = toSafeObject(payment);
    if (!obj) return null;

    return {
      id: extractId(obj),
      userId: obj.userId,
      invoiceId: obj.invoiceId,
      merchantId: obj.merchantId,
      schoolId: obj.schoolId,
      amount: toSafeNumber(obj.amount),
      currency: toSafeString(obj.currency, 'AOA'),
      status: toSafeString(obj.status, 'pending'),
      method: toSafeString(obj.method),
      rupeReference: toSafeString(obj.rupeReference),
      transactionId: obj.transactionId,
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform payment for user response
   * @param {Object} payment - Payment MongoDB document
   * @returns {Object} Payment DTO for user
   */
  forUser: (payment) => {
    if (!payment) return null;

    return {
      id: extractId(payment),
      amount: toSafeNumber(payment.amount),
      currency: toSafeString(payment.currency, 'AOA'),
      status: toSafeString(payment.status, 'pending'),
      method: toSafeString(payment.method),
      rupeReference: toSafeString(payment.rupeReference),
      createdAt: toISOString(payment.createdAt),
    };
  },

  /**
   * Transform payment for merchant response
   * @param {Object} payment - Payment MongoDB document
   * @returns {Object} Payment DTO for merchant
   */
  forMerchant: (payment) => {
    if (!payment) return null;

    return {
      id: extractId(payment),
      userId: payment.userId,
      userName: toSafeString(payment.userName),
      amount: toSafeNumber(payment.amount),
      currency: toSafeString(payment.currency, 'AOA'),
      status: toSafeString(payment.status, 'pending'),
      method: toSafeString(payment.method),
      rupeReference: toSafeString(payment.rupeReference),
      transactionId: payment.transactionId,
      createdAt: toISOString(payment.createdAt),
    };
  },

  /**
   * Transform array of payments
   * @param {Array} payments - Array of payment documents
   * @returns {Array} Array of payment DTOs
   */
  fromArray: (payments) => toSafeArray(payments).map(PaymentDTO.fromDocument),

  /**
   * Transform recharge document to DTO
   * @param {Object} recharge - Recharge MongoDB document
   * @returns {Object} Recharge DTO
   */
  rechargeFromDocument: (recharge) => {
    if (!recharge) return null;

    const obj = toSafeObject(recharge);
    if (!obj) return null;

    return {
      id: extractId(obj),
      userId: obj.userId,
      walletId: obj.walletId,
      schoolId: obj.schoolId,
      amount: toSafeNumber(obj.amount),
      currency: toSafeString(obj.currency, 'AOA'),
      rupeReference: toSafeString(obj.rupeReference),
      status: toSafeString(obj.status, 'pending'),
      paymentLink: `https://rupe-sandbox.gateway/pay?ref=${obj.rupeReference}&amount=${obj.amount}`,
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform cashout document to DTO
   * @param {Object} cashout - Cashout data
   * @returns {Object} Cashout DTO
   */
  cashoutFromData: (cashout) => {
    if (!cashout) return null;

    return {
      id: extractId(cashout),
      merchantId: cashout.merchantId,
      amount: toSafeNumber(cashout.amount),
      netAmount: toSafeNumber(cashout.netAmount),
      feeAmount: toSafeNumber(cashout.feeAmount),
      currency: toSafeString(cashout.currency, 'AOA'),
      bankAccount: toSafeString(cashout.bankAccount),
      status: toSafeString(cashout.status, 'pending'),
      transactionId: cashout.transactionId,
      createdAt: toISOString(cashout.createdAt),
    };
  },
};

export default PaymentDTO;
