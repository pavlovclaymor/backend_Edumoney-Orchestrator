import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    // Referência à escola
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true, // index para queries rápidas por escola
    },

    // Referência ao comerciante
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true, // index para queries rápidas por comerciante
    },

    // Nome da categoria
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Status ativo/inativo (útil para manter histórico sem deletar)
    isActive: {
      type: Boolean,
      default: true,
      index: true, // index para filtrar apenas categorias ativas
    },
  },
  { timestamps: true }, // createdAt e updatedAt automáticos
);

// Índices compostos para melhorar performance de filtros comuns
categorySchema.index({ schoolId: 1, merchantId: 1 });
categorySchema.index({ merchantId: 1, name: 1 }); // para evitar categorias duplicadas por merchant

// 🔥 Middleware automático para ObjectId
categorySchema.pre('save', function (next) {
  Object.keys(this.schema.paths).forEach((key) => {
    const pathType = this.schema.paths[key].instance;

    // Só aplica para ObjectId
    if (pathType === 'ObjectID' || pathType === 'ObjectId') {
      if (this.isModified(key) && typeof this[key] === 'string') {
        this[key] = mongoose.Types.ObjectId(this[key]);
      }
    }
  });

  next();
});

export default mongoose.model('Category', categorySchema);
