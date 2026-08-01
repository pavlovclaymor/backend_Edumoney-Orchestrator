import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import { TransactionDTO } from '../utils/dto/transaction.dto.js';
import Transaction from '../models/transaction.js';
import Wallet from '../models/wallet.js';
import User from '../models/user.model.js';
import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';

// Função auxiliar para padronizar resposta
const formatReport = ({
  transactions = [],
  balance = 0,
  totalCredits = 0,
  totalDebits = 0,
  totalPages = 1,
}) => ({
  transactions,
  balance,
  totalCredits,
  totalDebits,
  totalPages,
});

// ===============================
// Função para calcular direção corretamente
// ===============================
const getTransactionDirection = (tx, referenceId, referenceType) => {
  if (tx.type === 'recharge' || tx.senderType === 'Rupe') return 'incoming';

  if (tx.receiverType === referenceType && tx.receiverId?.toString() === referenceId.toString()) {
    return 'incoming';
  }

  if (tx.senderType === referenceType && tx.senderId?.toString() === referenceId.toString()) {
    return 'outgoing';
  }

  return 'unknown';
};

// ===============================
// Histórico de transações por usuário
// ===============================
export const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.userModel !== 'User' || req.user?._id?.toString() !== userId) {
      return res.status(403).send({ message: 'Acesso negado' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {
      $or: [
        { senderId: userId, senderType: 'User' },
        { receiverId: userId, receiverType: 'User' },
      ],
    };
   
    
    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const transactions = await Transaction.find()
      .populate('senderId', 'name email role')
      .populate('receiverId', 'name email role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });      
      
    const enrichedTransactions = transactions.map((tx) => ({
      ...tx.toObject(),
      direction: getTransactionDirection(tx, userId, 'User'),
    }));

    const totalCredits = enrichedTransactions
      .filter((t) => t.direction === 'incoming')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalDebits = enrichedTransactions
      .filter((t) => t.direction === 'outgoing')
      .reduce((acc, t) => acc + t.amount, 0);

    const wallet = await Wallet.findOne({
      ownerId: userId,
      ownerModel: 'User',
    });
    const dto = {
      transactions: enrichedTransactions.map((tx) => TransactionDTO.fromDocument(tx)),
      balance: wallet?.balance || 0,
      totalCredits,
      totalDebits,
      totalPages,
    };
    
    

    return res.status(200).json(ApiResponse.success(dto, 'Transações recuperadas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// ===============================
// Histórico de transações por merchant
// ===============================
export const getMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;
    if (req.userModel !== 'Merchant' || req.user?._id?.toString() !== merchantId) {
      return res.status(403).json(ErrorResponse.forbidden('Acesso negado'));
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json(ErrorResponse.notFound('Comerciante'));

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { senderId: merchantId, senderType: 'Merchant' },
        { receiverId: merchantId, receiverType: 'Merchant' },
      ],
    };
    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const transactions = await Transaction.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const enrichedTransactions = transactions.map((tx) => ({
      ...tx.toObject(),
      direction: getTransactionDirection(tx, merchantId, 'Merchant'),
    }));

    const totalCredits = enrichedTransactions
      .filter((t) => t.direction === 'incoming')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalDebits = enrichedTransactions
      .filter((t) => t.direction === 'outgoing')
      .reduce((acc, t) => acc + t.amount, 0);

    const merchantWallet = await Wallet.findOne({
      ownerId: merchantId,
      ownerModel: 'Merchant',
    });

    const dto = {
      transactions: enrichedTransactions.map((tx) => TransactionDTO.fromTransaction(tx)),
      balance: merchantWallet?.balance || 0,
      totalCredits,
      totalDebits,
      totalPages,
    };

    return res.status(200).json(ApiResponse.success(dto, 'Transações recuperadas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// ===============================
// Relatório da escola
// ===============================
export const getSchoolReport = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (req.userModel !== 'School' || req.user?._id?.toString() !== schoolId) {
      return res.status(403).json(ErrorResponse.forbidden('Acesso negado'));
    }

    const school = await School.findById(schoolId);
    if (!school) return res.status(404).json(ErrorResponse.notFound('Escola'));

    const users = await User.find({ schoolId }).select('_id name processNumber');
    const userIds = users.map((u) => u._id.toString());

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = {
        name: u.name,
        processNumber: u.processNumber,
      };
    });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { senderId: { $in: userIds }, senderType: 'User' },
        { receiverId: { $in: userIds }, receiverType: 'User' },
        { receiverId: { $in: school._id }, receiverType: 'School' },
      ],
    };
    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const transactions = await Transaction.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const enrichedTransactions = transactions.map((tx) => {
      const senderInfo =
        tx.senderId && userMap[tx.senderId.toString()] ? userMap[tx.senderId.toString()] : null;
      const receiverInfo =
        tx.receiverId && userMap[tx.receiverId.toString()]
          ? userMap[tx.receiverId.toString()]
          : null;

      const referenceId = senderInfo ? tx.senderId : receiverInfo ? tx.receiverId : null;
      const direction = referenceId ? getTransactionDirection(tx, referenceId, 'User') : 'unknown';

      return {
        ...tx.toObject(),
        senderInfo,
        receiverInfo,
        direction,
      };
    });

    const totalCredits = enrichedTransactions
      .filter((t) => t.direction === 'incoming' && t.status === 'completed')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalDebits = enrichedTransactions
      .filter((t) => t.direction === 'outgoing')
      .reduce((acc, t) => acc + t.amount, 0);

    const dto = {
      transactions: enrichedTransactions.map((tx) => TransactionDTO.fromTransaction(tx)),
      totalCredits,
      totalDebits,
      totalPages,
    };

    return res.status(200).json(ApiResponse.success(dto, 'Relatório recuperado'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};
