import { ApiResponse, ErrorResponse } from '../utils/responseWrapper.js';
import * as settingsService from '../services/settings.service.js';
import { recordAuditLog } from '../services/audit.service.js';

/**
 * Settings Controller
 * Handles all settings-related endpoints for merchants and schools.
 *
 * Security layers applied on every handler:
 *  1. Token authentication (via `protect` middleware)
 *  2. Type whitelist — only "merchant" and "school" are accepted
 *  3. Role-type consistency — the authenticated actor's model must match the
 *     requested type (prevents cross-entity access)
 *  4. Ownership validation — the actor's _id must match the resource id
 */

const ALLOWED_TYPES = ['merchant', 'school'];

/**
 * Centralised security check for all settings endpoints.
 * Returns an error response object, or null if the request is authorised.
 */
function authorizeSettingsRequest(req, res, type, id) {
  // 1. Type whitelist
  if (!ALLOWED_TYPES.includes(type)) {
    res.status(400).json({ success: false, message: 'Tipo de recurso inválido' });
    return false;
  }

  // 2. Role-type consistency: prevent merchant from accessing school and vice-versa
  const actorType = req.userModel?.toLowerCase();
  if (actorType !== type) {
    res.status(403).json({
      success: false,
      message: 'Acesso proibido: tipo de conta incompatível com o recurso solicitado',
    });
    return false;
  }

  // 3. Ownership: actor can only access their own resource
  if (String(req.user._id) !== String(id)) {
    res
      .status(403)
      .json({
        success: false,
        message: 'Acesso proibido: recurso não pertence ao utilizador autenticado',
      });
    return false;
  }

  return true;
}

// =====================================================================
// GET /api/settings/:type/:id
// =====================================================================
export const getSettings = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!authorizeSettingsRequest(req, res, type, id)) return;

    const settings =
      type === 'merchant'
        ? await settingsService.getMerchantSettings(id)
        : await settingsService.getSchoolSettings(id);

    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Erro interno ao buscar configurações' });
  }
};

// =====================================================================
// PATCH /api/settings/:type/:id
// =====================================================================
export const updateSettings = async (req, res) => {
  try {
    const { type, id } = req.params;
    const updates = req.body;

    if (!authorizeSettingsRequest(req, res, type, id)) return;

    let settings;
    if (type === 'merchant') {
      settings = await settingsService.updateMerchantSettings(id, updates);
      await recordAuditLog({
        userId: req.user._id,
        userModel: 'Merchant',
        action: 'MERCHANT_SETTINGS_UPDATED',
        entity: 'Merchant',
        entityId: id,
        status: 'success',
        schoolId: req.user.schoolId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } else {
      settings = await settingsService.updateSchoolSettings(id, updates);
      await recordAuditLog({
        userId: req.user._id,
        userModel: 'School',
        action: 'SCHOOL_SETTINGS_UPDATED',
        entity: 'School',
        entityId: id,
        status: 'success',
        schoolId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    return res
      .status(200)
      .json({ success: true, message: 'Configurações atualizadas com sucesso', settings });
  } catch (error) {
    await recordAuditLog({
      userId: req.user._id,
      userModel: req.userModel,
      action: `${req.userModel?.toUpperCase()}_SETTINGS_UPDATE_FAILED`,
      entity: req.userModel,
      entityId: req.params.id,
      status: 'failed',
      schoolId: req.userModel === 'Merchant' ? req.user.schoolId : req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { error: error.message },
    }).catch(() => {});

    return res
      .status(500)
      .json({
        success: false,
        message: error.message || 'Erro interno ao atualizar configurações',
      });
  }
};

// =====================================================================
// POST /api/settings/:type/:id/change-password
// =====================================================================
export const changePassword = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!authorizeSettingsRequest(req, res, type, id)) return;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'As senhas não coincidem' });
    }

    let result;
    if (type === 'merchant') {
      result = await settingsService.changeMerchantPassword(id, oldPassword, newPassword);
      await recordAuditLog({
        userId: req.user._id,
        userModel: 'Merchant',
        action: 'MERCHANT_PASSWORD_CHANGED',
        entity: 'Merchant',
        entityId: id,
        status: 'success',
        schoolId: req.user.schoolId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } else {
      result = await settingsService.changeSchoolPassword(id, oldPassword, newPassword);
      await recordAuditLog({
        userId: req.user._id,
        userModel: 'School',
        action: 'SCHOOL_PASSWORD_CHANGED',
        entity: 'School',
        entityId: id,
        status: 'success',
        schoolId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    await recordAuditLog({
      userId: req.user._id,
      userModel: req.userModel,
      action: `${req.userModel?.toUpperCase()}_PASSWORD_CHANGE_FAILED`,
      entity: req.userModel,
      entityId: req.params.id,
      status: 'failed',
      schoolId: req.userModel === 'Merchant' ? req.user.schoolId : req.user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { error: error.message },
    }).catch(() => {});

    return res
      .status(400)
      .json({ success: false, message: error.message || 'Erro ao alterar senha' });
  }
};
