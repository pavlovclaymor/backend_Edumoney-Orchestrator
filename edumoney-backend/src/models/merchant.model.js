import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const merchantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    nif: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{9}$/, 'NIF inválido. Deve conter 9 dígitos.'],
    },

    category: {
      type: String,
      enum: ['papelaria', 'cantina', 'outro'],
      default: 'outro',
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    address: {
      type: String,
      trim: true,
      default: null,
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
    },

    role: {
      type: String,
      default: 'merchant',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    profilePicture: {
      type: String,
      default: null,
    },

    preferences: {
      notifications: { type: Boolean, default: true },
      darkMode: { type: Boolean, default: false },
      webhookUrl: { type: String, default: null },
      notificationEmail: { type: String, default: null },
    },

    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      alertThreshold: { type: Number, default: 0 },
    },

    securitySettings: {
      passwordChangedAt: { type: Date, default: null },
    },

    termsAccepted: {
      type: Boolean,
      default: false,
    },

    termsAcceptedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

/*  HASH DA SENHA */
merchantSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/*  MÉTODO */
merchantSchema.methods.matchPassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model('Merchant', merchantSchema);
