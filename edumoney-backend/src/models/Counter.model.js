import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

// único por merchant + tipo
counterSchema.index({ merchantId: 1, name: 1 }, { unique: true });

export default mongoose.model('Counter', counterSchema);
