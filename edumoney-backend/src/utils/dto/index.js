/**
 * DTO Index
 * Central export for all DTO modules
 */

// Base utilities
export * from './base.dto.js';

// Entity DTOs
export { WalletDTO } from './wallet.dto.js';
export { TransactionDTO } from './transaction.dto.js';
export { MerchantDTO } from './merchant.dto.js';
export { SchoolDTO } from './school.dto.js';
export { UserDTO } from './user.dto.js';
export { AdminDTO } from './admin.dto.js';
export { InvoiceDTO } from './invoice.dto.js';
export { PaymentDTO } from './payment.dto.js';
export { AuthDTO } from './auth.dto.js';
export { CategoryDTO, ProductDTO, RechargeDTO } from './category.dto.js';
export { RupeDTO } from './rupe.dto.js';
export { CertificateDTO } from './certificate.dto.js';

// Default exports
export { default as BaseDTO } from './base.dto.js';
export { default as Wallet } from './wallet.dto.js';
export { default as Transaction } from './transaction.dto.js';
export { default as Merchant } from './merchant.dto.js';
export { default as School } from './school.dto.js';
export { default as User } from './user.dto.js';
export { default as Admin } from './admin.dto.js';
export { default as Invoice } from './invoice.dto.js';
export { default as Payment } from './payment.dto.js';
export { default as Auth } from './auth.dto.js';
export { default as Rupe } from './rupe.dto.js';
export { default as Certificate } from './certificate.dto.js';
