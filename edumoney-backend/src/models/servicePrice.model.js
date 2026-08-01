import mongoose from 'mongoose';

const servicePriceSchema = new mongoose.Schema(
  {
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

    quantidade: {
      type: Number,
      default: 1,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

servicePriceSchema.index({ schoolId: 1, tipoServico: 1 }, { unique: true });

export default mongoose.model('ServicePrice', servicePriceSchema);
