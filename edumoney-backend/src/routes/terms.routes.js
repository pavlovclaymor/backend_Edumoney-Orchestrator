import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import User from '../models/user.model.js';
import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';

const router = express.Router();

router.post('/accept', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    let userModel = User;

    console.log(userId);
    if (req.user.role === 'merchant') {
      userModel = Merchant;
    } else if (req.user.role === 'school') {
      userModel = School;
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    user.termsAccepted = true;
    user.termsAcceptedAt = new Date();
    await user.save();

    return res.status(200).json({
      message: 'Termos de uso aceitos com sucesso',
      termsAccepted: true,
      termsAcceptedAt: user.termsAcceptedAt,
    });
  } catch (error) {
    console.error('Erro ao aceitar termos:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

export default router;
