import mongoose from 'mongoose';

const rupeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    tipoServico: {
      type: String,
      enum: ['CERTIFICADO', 'DECLARACAO_COM_NOTA', 'DECLARACAO_SEM_NOTA', 'FOLHA_PROVA'],
      required: true,
    },
    valor: {
      type: Number,
      required: true,
    },
    estado: {
      type: String,
      enum: ['PENDENTE', 'PAGO', 'CANCELADO'],
      default: 'PENDENTE',
    },
    referencia: {
      type: String,
      unique: true,
      required: true,
    },
    quantidade: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true },
);

export default mongoose.model('Rupe', rupeSchema);
