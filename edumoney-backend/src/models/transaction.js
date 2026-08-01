import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    senderType: {
      type: String,
      enum: ['User', 'Merchant', 'School', 'Wallet', 'Rupe'],
      required: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    receiverType: {
      type: String,
      enum: ['User', 'Merchant', 'School', 'Wallet'],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    fee: {
      type: Number,
      default: 0,
    },

    type: {
      type: String,
      enum: ['payment', 'recharge', 'cashout', 'transfer'],
      required: true,
    },

    description: {
      type: String,
    },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },

    externalReference: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }, // importante habilitar virtuals
);

// Virtual para definir direção da transação
transactionSchema.virtual('direction').get(function () {
  if (this.type === 'recharge') return 'incoming'; // recargas sempre incoming
  if (this.senderType === 'Rupe') return 'incoming'; // qualquer recarga RUPE
  if (!this.senderId || !this.receiverId) return 'unknown';
  return this.senderId.toString() === this._userId?.toString() ? 'outgoing' : 'incoming';
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
