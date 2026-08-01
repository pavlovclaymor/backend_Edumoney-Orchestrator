import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'ownerModel',
    },

    ownerModel: {
      type: String,
      required: true,
      enum: ['User', 'Merchant', 'School'],
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: 'AOA',
    },

    status: {
      type: String,
      enum: ['active', 'suspended', 'closed'],
      default: 'active',
    },

    totalCredits: {
      type: Number,
      default: 0,
    },

    totalDebits: {
      type: Number,
      default: 0,
    },

    lastTransactionAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// crédito seguro
walletSchema.methods.credit = function (amount) {
  if (amount <= 0) throw new Error('Invalid credit amount');

  this.balance += amount;
  this.totalCredits += amount;
  this.lastTransactionAt = new Date();
};

// débito seguro
walletSchema.methods.debit = function (amount) {
  if (amount <= 0) throw new Error('Invalid debit amount');

  if (this.balance < amount) throw new Error('Insufficient balance');

  this.balance -= amount;
  this.totalDebits += amount;
  this.lastTransactionAt = new Date();
};

walletSchema.index({ ownerId: 1, ownerModel: 1 }, { unique: true });

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
