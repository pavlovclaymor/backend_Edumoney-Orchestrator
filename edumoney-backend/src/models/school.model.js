import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const schoolSchema = new mongoose.Schema(
  {
    // Dados principais
    name: { type: String, required: true, trim: true },
    nif: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: (v) => /^\d{9}$/.test(v),
        message: (props) => `${props.value} não é um NIF válido. Deve conter 9 dígitos.`,
      },
    },
    logo: { type: String, default: null },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
      default: null,
    },
    phone: { type: String, trim: true, default: null },
    address: { type: String, required: true, trim: true },

    // Controle financeiro
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null,
    },
    feeRate: { type: Number, min: 0, max: 1, default: 0.5 },

    // Controle de documentos
    documentsRequested: { type: Number, default: 0 },
    documentsFinished: { type: Number, default: 0 },
    sheetsPrinted: { type: Number, default: 0 }, // Folhas disponíveis
    sheetsSold: { type: Number, default: 0 }, // Folhas vendidas
    certificateRequested: { type: Number, default: 0 }, // CErtificados solicitados
    certificateFinished: { type: Number, default: 0 }, //Certificados emitidos

    // Status e segurança
    status: {
      type: String,
      enum: ['ativo', 'inativo', 'suspenso'],
      default: 'ativo',
    },
    password: {
      type: String,
      required: true,
      trim: true,
      select: false,
      minlength: 6,
    },
    role: { type: String, default: 'school' },

    // Campos opcionais de front/profissionalização
    profileUpdatedAt: { type: Date, default: null },
    description: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },

    profilePicture: { type: String, default: null },
    preferences: {
      notifications: { type: Boolean, default: true },
      darkMode: { type: Boolean, default: false },
      schoolWebsite: { type: String, default: null },
    },

    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      adminEmail: { type: String, default: null },
    },

    securitySettings: {
      passwordChangedAt: { type: Date, default: null },
    },

    termsAccepted: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

//  Hash da senha antes de salvar
schoolSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

//  Comparar senha
schoolSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

//  Métodos de documentos
schoolSchema.methods.requestDocument = function (quantity = 1) {
  this.documentsRequested += quantity;
  return this.documentsRequested;
};

schoolSchema.methods.incrementCertificateRequests = function (quantity = 1) {
  this.certificateRequested += quantity;
  return this.certificateRequested;
};

// Backward compatible alias for older calls.
schoolSchema.methods.certificateRequeste = function (quantity = 1) {
  return this.incrementCertificateRequests(quantity);
};

schoolSchema.methods.finishDocument = function (quantity = 1) {
  this.documentsFinished += quantity;
  return this.documentsFinished;
};

// 🗓 Atualizar timestamp do perfil
schoolSchema.methods.updateProfileTimestamp = function () {
  this.profileUpdatedAt = new Date();
  return this.profileUpdatedAt;
};

// Novo método seguro para vender folhas
schoolSchema.methods.sellSheets = function (quantity) {
  if (!quantity || quantity <= 0) return 0;

  if (this.sheetsPrinted < quantity) {
    throw new Error('Folhas impressas insuficientes para vender');
  }

  this.sheetsPrinted -= quantity; // subtrai do estoque
  this.sheetsSold += quantity; // aumenta o vendido
  return quantity;
};

const School = mongoose.model('School', schoolSchema);

export default School;
