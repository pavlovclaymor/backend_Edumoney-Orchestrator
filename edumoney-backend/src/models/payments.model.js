import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    // transactionId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Transaction',
    //     required: true
    // },
    payerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: ['qr', 'direct'],
      required: true,
    },
    qrCode: {
      type: String,
      default: null,
    },
    fee: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    description: {
      type: String,
      default: 'Pagamento via Edumoney',
    },
  },
  { timestamps: true },
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
