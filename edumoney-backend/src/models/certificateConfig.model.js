import mongoose from 'mongoose';

const certificateConfigSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      unique: true,
    },
    templateName: {
      type: String,
      default: 'Template Padrão',
    },
    headerText: {
      type: String,
      default: 'República de Angola\nMinistério da Educação',
    },
    signatoryName: {
      type: String,
      default: '',
    },
    signatoryRole: {
      type: String,
      default: 'O Diretor Geral',
    },
    includeGradesDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const CertificateConfig = mongoose.model('CertificateConfig', certificateConfigSchema);
export default CertificateConfig;
