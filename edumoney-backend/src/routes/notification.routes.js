import e from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  // getUnreadCount,
  createNotification,
} from '../controllers/notification.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = e.Router();

// ================== PROTECTED — QUALQUER AUTENTICADO ==================

// Listar notificações do usuário autenticado
router.get('/', protect, getNotifications);

// Contar notificações não lidas
// router.get("/unread-count", protect, getUnreadCount);

// Marcar todas como lidas
router.put('/read-all', protect, markAllAsRead);

// Marcar uma notificação como lida
router.put('/:id/read', protect, markAsRead);

// Deletar uma notificação
router.delete('/:id', protect, deleteNotification);

// ================== PROTECTED — ESCOLA (ADMIN) ==================

// Criar notificação (qualquer um pode criar notificações para seus parceiros)
router.post('/', protect, createNotification);

export default router;
