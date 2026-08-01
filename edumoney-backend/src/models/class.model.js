import mongoose from 'mongoose';

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // ex: II13C
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    year: { type: Number, required: true },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true },
);

// 🔥 Middleware automático para ObjectId
classSchema.pre('save', function (next) {
  Object.keys(this.schema.paths).forEach((key) => {
    const path = this.schema.paths[key];

    // Se for array de ObjectIds
    if (path instanceof mongoose.Schema.Types.Array && path.caster?.instance === 'ObjectID') {
      if (Array.isArray(this[key])) {
        this[key] = this[key].map((v) => (typeof v === 'string' ? mongoose.Types.ObjectId(v) : v));
      }
    }

    // Se for ObjectId simples
    if (path.instance === 'ObjectID' || path.instance === 'ObjectId') {
      if (this.isModified(key) && typeof this[key] === 'string') {
        this[key] = mongoose.Types.ObjectId(this[key]);
      }
    }
  });

  next();
});

const Class = mongoose.model('Class', classSchema);
export default Class;
