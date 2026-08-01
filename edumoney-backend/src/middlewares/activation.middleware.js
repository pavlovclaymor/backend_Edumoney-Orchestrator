import { validateAccountActivation } from '../services/accountValidation.service.js';

/**
 * Middleware to enforce fully activated account requirement.
 * Used on routes that require complete account activation
 * (e.g., RUPE creation, payments, financial operations).
 *
 * Usage: router.post("/rupe", protect, authorize("student"), requireFullyActivatedAccount, rupeController)
 */
export const requireFullyActivatedAccount = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).send({
        message: 'Não autenticado',
      });
    }

    // Only applies to students/users
    if (req.userModel !== 'User') {
      return next();
    }

    // Validate account activation
    const validation = await validateAccountActivation(req.user._id);
    console.log(`[ActivationMiddleware] Account activation validation for user ${req.user._id}`);
    if (!validation.activated) {
      return res.status(403).send({
        message: 'Conta não ativada',
        details: validation.message,
        requiresActivation: true,
      });
    }

    // Account is activated, proceed
    next();
  } catch (error) {
    console.error('[ActivationMiddleware] Error:', error);
    return res.status(500).send({
      message: 'Erro ao validar ativação da conta',
    });
  }
};
