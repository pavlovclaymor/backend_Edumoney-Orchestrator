import mongoose from 'mongoose';

const certificateLogSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    studentNumber: {
      type: String,
      required: true,
    },
    processNumber: {
      type: String,
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    class: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      required: true,
    },
    documentType: {
      type: String,
      enum: ['Certificado', 'Declaração'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    includeGrades: {
      type: Boolean,
      default: false,
    },
    institution: {
      type: String,
      required: true,
    },
    requestId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['issued', 'failed'],
      default: 'issued',
    },

    // Request tracking fields for decoupled integration
    requestStatus: {
      type: String,
      enum: ['pending', 'submitted', 'completed', 'failed'],
      default: 'pending',
    },

    requestedBy: {
      type: String,
      default: null,
    },

    statusUpdatedAt: {
      type: Date,
      default: null,
    },

    // Metadata for tracking external service responses
    metadata: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexing for search optimization
certificateLogSchema.index({ schoolId: 1, createdAt: -1 });
certificateLogSchema.index({ schoolId: 1, requestStatus: 1 });
certificateLogSchema.index({ requestId: 1 });

const CertificateLog = mongoose.model('CertificateLog', certificateLogSchema);
export default CertificateLog;
