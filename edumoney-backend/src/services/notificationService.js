import Notification from '../models/notification.model.js';
import { getIO } from '../socket/index.js';
import { SOCKET_EVENTS } from '../socket/events.js';

/**
 * Creates a notification in DB and sends it via Socket.IO if user is connected
 */
export const sendNotification = async (userId, payload) => {
  try {
    const {
      recipientType = 'User',
      title,
      message,
      type = 'info',
      priority = 'normal',
      referenceId = null,
      referenceType = null,
      metadata = {},
    } = payload;

    // Create in DB (Fallback / persistence)
    const notification = await Notification.create({
      recipientId: userId,
      recipientType,
      title,
      message,
      type,
      priority,
      referenceId,
      referenceType,
      metadata,
    });

    // Emit in real-time
    const io = getIO();
    io.to(userId.toString()).emit(SOCKET_EVENTS.NOTIFICATION, {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      createdAt: notification.createdAt,
      metadata: notification.metadata,
    });

    return notification;
  } catch (error) {
    console.error('[NotificationService] Error sending notification:', error);
  }
};

/**
 * Emits a broadcast event directly via socket to all users
 */
export const broadcastNotification = async (payload) => {
  try {
    const io = getIO();
    io.emit(SOCKET_EVENTS.NOTIFICATION, {
      title: payload.title,
      message: payload.message,
      type: payload.type || 'system',
      createdAt: new Date(),
      data: payload.data || {},
    });
  } catch (error) {
    console.error(`[NotificationService] Error broadcasting event:`, error);
  }
};
