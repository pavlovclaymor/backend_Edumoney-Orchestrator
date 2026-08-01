import Notification from '../models/notification.model.js';
import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';

// Criar notificação
export const createNotification = async (
  userId,
  userModel,
  title,
  message,
  type,
  priority,
  referenceId,
  referenceModel,
) => {
  try {
    const notification = new Notification({
      userId,
      userModel,
      title,
      message,
      type,
      priority,
      referenceId,
      referenceModel,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return null;
  }
};

// Obter notificações por usuário
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments({ userId });

    // Apply DTO transformation
    const dto = (notifications || []).map((n) => ({
      id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      priority: n.priority,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));

    return res.status(200).json(ApiResponse.list(dto, total, 'Notificações recuperadas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// Marcar como lida
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    await Notification.findByIdAndUpdate(notificationId, { isRead: true });

    return res
      .status(200)
      .json(ApiResponse.success({ success: true }, 'Notificação marcada como lida'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// Marcar todas como lidas
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    await Notification.updateMany({ userId, isRead: false }, { isRead: true });

    return res
      .status(200)
      .json(ApiResponse.success({ success: true }, 'Todas notificações marcadas como lidas'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};

// Deletar notificação
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    await Notification.findByIdAndDelete(notificationId);

    return res.status(200).json(ApiResponse.success({ deleted: true }, 'Notificação deletada'));
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json(ErrorResponse.internal(error.message));
  }
};
