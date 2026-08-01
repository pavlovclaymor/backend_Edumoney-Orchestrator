import { getIO } from '../services/socket.service.js';

export const emitPaymentEvents = ({ senderId, receiverId, type, transaction }) => {
  try {
    const io = getIO();

    const payload = {
      type,
      transaction,
    };

    if (senderId) {
      io.to(senderId.toString()).emit('payment:success', payload);
      io.to(senderId.toString()).emit('wallet:updated');
    }

    if (receiverId) {
      io.to(receiverId.toString()).emit('payment:received', payload);
      io.to(receiverId.toString()).emit('wallet:updated');
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};
