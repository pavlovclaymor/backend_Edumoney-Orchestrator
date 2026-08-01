/**
 * Invoice DTO
 * Transforms invoice MongoDB documents to API response format
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
 * Transform invoice document to DTO
 * @param {Object} invoice - Invoice MongoDB document
 * @returns {Object} Invoice DTO
 */
export const InvoiceDTO = {
  fromDocument: (invoice) => {
    if (!invoice) return null;

    const obj = toSafeObject(invoice);
    if (!obj) return null;

    return {
      id: extractId(obj),
      invoiceNumber: toSafeString(obj.invoiceNumber),
      merchantId: obj.merchantId,
      merchantName: toSafeString(obj.merchantName),
      schoolId: obj.schoolId,
      clientName: toSafeString(obj.clientName),
      clientEmail: toSafeString(obj.clientEmail),
      items: toSafeArray(obj.items).map((item) => ({
        name: toSafeString(item.name),
        description: toSafeString(item.description),
        quantity: toSafeNumber(item.quantity),
        unitPrice: toSafeNumber(item.unitPrice),
        totalPrice: toSafeNumber(item.totalPrice),
      })),
      subtotal: toSafeNumber(obj.subtotal),
      discountAmount: toSafeNumber(obj.discountAmount, 0),
      totalAmount: toSafeNumber(obj.totalAmount),
      currency: toSafeString(obj.currency, 'AOA'),
      status: toSafeString(obj.status, 'pending'),
      paymentMethod: toSafeString(obj.paymentMethod),
      paymentDate: toISOString(obj.paymentDate),
      rupeReference: toSafeString(obj.rupeReference),
      paidBy: obj.paidBy,
      paidByName: toSafeString(obj.paidByName),
      createdAt: toISOString(obj.createdAt),
      updatedAt: toISOString(obj.updatedAt),
    };
  },

  /**
   * Transform invoice for list response (minimal data)
   * @param {Object} invoice - Invoice MongoDB document
   * @returns {Object} Minimal invoice DTO
   */
  forList: (invoice) => {
    if (!invoice) return null;

    return {
      id: extractId(invoice),
      invoiceNumber: toSafeString(invoice.invoiceNumber),
      merchantName: toSafeString(invoice.merchantName),
      clientName: toSafeString(invoice.clientName),
      totalAmount: toSafeNumber(invoice.totalAmount),
      currency: toSafeString(invoice.currency, 'AOA'),
      status: toSafeString(invoice.status, 'pending'),
      createdAt: toISOString(invoice.createdAt),
    };
  },

  /**
   * Transform invoice for merchant response
   * @param {Object} invoice - Invoice MongoDB document
   * @returns {Object} Invoice DTO for merchant
   */
  forMerchant: (invoice) => {
    if (!invoice) return null;

    return {
      id: extractId(invoice),
      invoiceNumber: toSafeString(invoice.invoiceNumber),
      clientName: toSafeString(invoice.clientName),
      clientEmail: toSafeString(invoice.clientEmail),
      items: toSafeArray(invoice.items).map((item) => ({
        name: toSafeString(item.name),
        quantity: toSafeNumber(item.quantity),
        unitPrice: toSafeNumber(item.unitPrice),
        totalPrice: toSafeNumber(item.totalPrice),
      })),
      totalAmount: toSafeNumber(invoice.totalAmount),
      currency: toSafeString(invoice.currency, 'AOA'),
      status: toSafeString(invoice.status, 'pending'),
      createdAt: toISOString(invoice.createdAt),
    };
  },

  /**
   * Transform invoice for student response (after payment)
   * @param {Object} invoice - Invoice MongoDB document
   * @returns {Object} Invoice DTO for student
   */
  forStudent: (invoice) => {
    if (!invoice) return null;

    return {
      id: extractId(invoice),
      invoiceNumber: toSafeString(invoice.invoiceNumber),
      merchantName: toSafeString(invoice.merchantName),
      items: toSafeArray(invoice.items).map((item) => ({
        name: toSafeString(item.name),
        quantity: toSafeNumber(item.quantity),
        totalPrice: toSafeNumber(item.totalPrice),
      })),
      totalAmount: toSafeNumber(invoice.totalAmount),
      currency: toSafeString(invoice.currency, 'AOA'),
      status: toSafeString(invoice.status, 'pending'),
      paymentDate: toISOString(invoice.paymentDate),
      createdAt: toISOString(invoice.createdAt),
    };
  },

  /**
   * Transform array of invoices
   * @param {Array} invoices - Array of invoice documents
   * @returns {Array} Array of invoice DTOs
   */
  fromArray: (invoices) => toSafeArray(invoices).map(InvoiceDTO.fromDocument),

  /**
   * Transform array for list response
   * @param {Array} invoices - Array of invoice documents
   * @returns {Array} Array of minimal invoice DTOs
   */
  listFromArray: (invoices) => toSafeArray(invoices).map(InvoiceDTO.forList),
};

export default InvoiceDTO;
