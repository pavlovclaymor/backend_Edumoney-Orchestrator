import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    // Referência à escola
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },

    // Referência ao comerciante
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },

    // Imagem do produto (URL)
    img: {
      type: String,
      trim: true,
    },

    // Nome do produto
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Preço do produto
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // Quantidade em stock
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Categoria do produto
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },

    // Status ativo/inativo
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Índices compostos para filtros frequentes
productSchema.index({ merchantId: 1, schoolId: 1 });
productSchema.index({ merchantId: 1, categoryId: 1 });
productSchema.index({ merchantId: 1, name: 1 }, { unique: false }); // evita duplicação fácil dentro do mesmo merchant

export default mongoose.model('Product', productSchema);
