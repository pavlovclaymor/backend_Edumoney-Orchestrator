import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    /* ===========================
       DESTINATÁRIO
    =========================== */
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'recipientType',
    },

    recipientType: {
      type: String,
      enum: ['User', 'Merchant', 'School'],
      required: true,
    },

    /* ===========================
       CONTEÚDO
    =========================== */
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    /* ===========================
       TIPO E CATEGORIA
    =========================== */
    type: {
      type: String,
      enum: [
        'transaction', // Pagamentos, transferências, recargas
        'security', // Alertas de segurança, login, senha
        'system', // Avisos do sistema, manutenção
        'promotion', // Promoções, ofertas
        'reminder', // Lembretes
        'info', // Informações gerais
      ],
      default: 'info',
    },

    /* ===========================
       PRIORIDADE
    =========================== */
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    /* ===========================
       REFERÊNCIA (OPCIONAL)
    =========================== */
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    referenceType: {
      type: String,
      enum: ['Transaction', 'Payment', 'Recharge', 'Invoice', null],
      default: null,
    },

    /* ===========================
       STATUS
    =========================== */
    read: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    /* ===========================
       METADADOS
    =========================== */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /* ===========================
       EXPIRAÇÃO (OPCIONAL)
    =========================== */
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

/* ===========================
   ÍNDICES
=========================== */
notificationSchema.index({ recipientId: 1, recipientType: 1 });
notificationSchema.index({ recipientId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

/* ===========================
   MÉTODOS ESTÁTICOS
=========================== */

// Criar notificação
// notificationSchema.statics.createNotification = async function ({
//   recipientId,
//   recipientType,
//   title,
//   message,
//   type = "info",
//   priority = "normal",
//   referenceId = null,
//   referenceType = null,
//   metadata = {},
//   expiresAt = null,
// }) {
//   return this.create({
//     recipientId,
//     recipientType,
//     title,
//     message,
//     type,
//     priority,
//     referenceId,
//     referenceType,
//     metadata,
//     expiresAt,
//   });
// };

// Buscar notificações não lidas
notificationSchema.statics.getUnreadCount = async function (recipientId, recipientType) {
  return this.countDocuments({
    recipientId,
    recipientType,
    read: false,
  });
};

/* ===========================
   MÉTODOS DE INSTÂNCIA
=========================== */

// Marcar como lida
notificationSchema.methods.markAsRead = async function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

/* ===========================
   EXPORT
=========================== */
const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
