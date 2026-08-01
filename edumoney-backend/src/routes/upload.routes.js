import fs from 'fs';
import path from 'path';
import multer from 'multer';
import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import User from '../models/user.model.js';
import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';

const router = express.Router();

// Configurar o diretório base de uploads
const baseUploadDir = 'uploads/profiles';

// Garantir que a pasta base exista
if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user._id.toString();
    const userDir = path.join(baseUploadDir, userId);

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens nos formatos JPEG, JPG e PNG são permitidas.'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

const handleUpload = async (req, res, Model) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhuma imagem fornecida' });
    }

    const userId = req.user._id;
    const profilePicturePath = `/uploads/profiles/${userId}/${req.file.filename}`;

    const updatedEntity = await Model.findByIdAndUpdate(
      userId,
      { profilePicture: profilePicturePath },
      { new: true },
    );

    if (!updatedEntity) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    return res.status(200).json({
      message: 'Foto de perfil atualizada com sucesso',
      profilePicture: profilePicturePath,
    });
  } catch (error) {
    console.error('Erro no upload de foto:', error);
    return res.status(500).json({ message: 'Erro interno ao processar upload' });
  }
};

// Endpoints separados para garantir roles e evitar falhas de lógica
router.post(
  '/student',
  protect,
  authorize('student', 'teacher'),
  upload.single('profilePicture'),
  (req, res) => handleUpload(req, res, User),
);
router.post(
  '/merchant',
  protect,
  authorize('merchant'),
  upload.single('profilePicture'),
  (req, res) => handleUpload(req, res, Merchant),
);
router.post('/school', protect, authorize('school'), upload.single('profilePicture'), (req, res) =>
  handleUpload(req, res, School),
);

export default router;
