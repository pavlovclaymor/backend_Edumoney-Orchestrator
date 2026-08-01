import mongoose from 'mongoose';

const schoolRegistrySchema = new mongoose.Schema({
  nif: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  province: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['public', 'private'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const SchoolRegistry = mongoose.model('SchoolRegistry', schoolRegistrySchema);
export default SchoolRegistry;
