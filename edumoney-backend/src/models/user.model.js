import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    /* ===========================
       DADOS PRINCIPAIS
    =========================== */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    processNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^(?:\d+|[a-zA-Z0-9]+)$/,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    email_verified: {
      type: Boolean,
      default: false,
    },

    pending_email: {
      type: String,
      default: null,
    },

    verification_code: {
      type: String,
    },

    code_expires_at: {
      type: Date,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    whatsapp: {
      type: String,
      trim: true,
      default: null,
    },

    /* ===========================
       IDENTIDADE (BI)
    =========================== */
    biNumber: {
      type: String,
      trim: true,
      default: null,
    },

    biFrontImage: {
      type: String, // URL ou caminho do arquivo
      default: null,
    },

    biBackImage: {
      type: String,
      default: null,
    },

    identityVerified: {
      type: Boolean,
      default: false,
    },

    /* ===========================
       SEGURANÇA
    =========================== */
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 6,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },
    pin: {
      type: String, // armazena o hash do PIN
      minlength: 4, // valida o PIN original antes de hash
      maxlength: 60, // ou remova, porque hash é sempre maior
      select: false,
    },

    securityLogs: [
      {
        action: {
          type: String,
          enum: [
            'LOGIN',
            'LOGOUT',
            'PASSWORD_CHANGED',
            'PROFILE_UPDATED',
            'ACCOUNT_DELETED',
            'PIN_SET',
          ],
          required: true,
        },
        ip: {
          type: String,
          default: null,
        },
        userAgent: {
          type: String,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    /* ===========================
       SISTEMA
    =========================== */
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
      description: 'Papel do usuário: student|teacher|admin',
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },

    status: {
      type: String,
      enum: ['ativo', 'inativo'],
      default: 'inativo',
    },
    isActive: {
      type: Boolean,
    },

    /* ===========================
       ACADÊMICO
    =========================== */
    certificatesRequested: {
      type: Number,
      default: 0,
    },

    certificatesIssued: {
      type: Number,
      default: 0,
    },

    turma: {
      type: String,
      default: null,
      trim: true,
    },

    year: {
      type: Number,
      default: null,
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null,
    },

    /* ===========================
       UX / PERFIL
    =========================== */
    profileUpdatedAt: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    /* ===========================
       PREFERÊNCIAS
    =========================== */
    preferences: {
      notifications: { type: Boolean, default: true },
      darkMode: { type: Boolean, default: false },
    },

    /* ===========================
       EXTRAS
    =========================== */
    profilePicture: {
      type: String,
      default: null,
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

/* ===========================
   ÍNDICES
=========================== */
userSchema.index({ processNumber: 1, schoolId: 1 }, { unique: true });

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      $and: [{ email: { $exists: true } }, { email: { $ne: null } }, { email: { $ne: '' } }],
    },
  },
);

/* ===========================
   HASH DE SENHA
=========================== */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  //  Atualiza quando senha muda
  this.passwordChangedAt = new Date();

  next();
});

/* ===========================
   MÉTODOS
=========================== */
userSchema.methods.matchPassword = async function (plainPassword) {
  return bcrypt.compareSync(plainPassword, this.password);
};

userSchema.methods.addSecurityLog = function (action, req = null) {
  this.securityLogs.push({
    action,
    ip: req?.ip || null,
    userAgent: req?.headers['user-agent'] || null,
  });

  //mantém só os últimos 20 logs
  if (this.securityLogs.length > 20) {
    this.securityLogs.shift();
  }
};

/**
 * Checks if the student account is fully activated.
 * Activation requires:
 * - password changed (passwordChangedAt is set)
 * - PIN configured (pin is set)
 * - account status is "ativo"
 * @returns {boolean} true if account is fully activated
 */
userSchema.methods.isAccountFullyActivated = function () {
  return !!this.passwordChangedAt && !!this.pin && this.status == 'ativo';
};

/* ===========================
   EXPORT
=========================== */
const User = mongoose.model('User', userSchema);

export default User;
