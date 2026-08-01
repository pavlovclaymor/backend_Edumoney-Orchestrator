import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    /* RELAÇÕES */
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },

    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ['invoice', 'receipt', 'credit_note'],
      default: 'invoice',
    },

    /* CLIENTE */
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    clientName: { type: String, trim: true },
    clientEmail: { type: String, lowercase: true, trim: true },

    /* ITENS */
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        description: String,
        quantity: { type: Number, min: 1 },
        price: { type: Number, min: 0 },
        subtotal: { type: Number, min: 0 },
      },
    ],

    /* VALORES */
    subtotalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    currency: { type: String, default: 'AOA' },

    /* =========================
       STATUS FINANCEIRO CORE
    ========================= */

    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled', 'processing', 'failed'],
      default: 'pending',
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'awaiting', 'paid', 'failed', 'expired'],
      default: 'unpaid',
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['CASH', 'WALLET'],
      default: 'WALLET',
    },

    /* =========================
       REFERÊNCIA DE PAGAMENTO
    ========================= */

    paymentReference: {
      type: String,
      default: null,
      index: true,
    },

    paymentProvider: {
      type: String,
      enum: ['rupe', 'qr', 'wallet', 'cash'],
      default: null,
    },
    /* PAYMENT CONTROL (TRANSFER FLOW) */
    rupeReference: {
      type: String,
      default: null,
      index: true,
    },

    rupeStatus: {
      type: String,
      enum: ['pending', 'paid', 'expired', 'cancelled', 'failed', 'processing'],
      default: null,
    },

    /* =========================
       CONTROLE DE TEMPO
    ========================= */

    dueDate: { type: Date, default: null },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    paidAt: { type: Date, default: null },

    rupeExpiresAt: {
      type: Date,
      default: null,
    },
    /* =========================
       DOCUMENTO
    ========================= */

    pdfUrl: { type: String, default: null },

    qrCode: { type: String, default: null },

    isLocked: { type: Boolean, default: false },

    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

/* Índices */
invoiceSchema.index({ merchantId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ merchantId: 1, status: 1 });
invoiceSchema.index({ merchantId: 1, issuedAt: -1 });

export default mongoose.model('Invoice', invoiceSchema);
