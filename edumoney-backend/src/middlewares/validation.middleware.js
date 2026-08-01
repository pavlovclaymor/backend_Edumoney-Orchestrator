import ValidationService from '../services/validation.service.js';

/**
 * Middleware factory to validate uniqueness of fields across multiple models
 * @param {string[]} fields - List of fields to validate (e.g., ['email', 'nif'])
 * @returns {Function} - Express middleware
 */
export const validateUniqueness = (fields = []) => {
  return async (req, res, next) => {
    try {
      const { email, nif } = req.body;

      // Try to find an ID in params to exclude (for updates)
      const excludeId =
        req.params.id || req.params.schoolId || req.params.merchantId || req.user?._id;

      const errors = [];

      // Validate Email
      if (fields.includes('email') && email) {
        const isEmailTaken = await ValidationService.isEmailTaken(email, excludeId);
        if (isEmailTaken) {
          errors.push({
            field: 'email',
            message: 'Este e-mail já está em uso por outro usuário ou entidade.',
          });
        }
      }

      // Validate NIF
      if (fields.includes('nif') && nif) {
        const isNifTaken = await ValidationService.isNifTaken(nif, excludeId);
        if (isNifTaken) {
          errors.push({
            field: 'nif',
            message: 'Este NIF já está registado para outro comerciante ou escola.',
          });
        }
      }

      // If errors exist, return 400 with a clean structure
      if (errors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Falha na validação de unicidade.',
          errors,
        });
      }

      next();
    } catch (error) {
      console.error('Uniqueness Middleware Error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao validar dados.',
      });
    }
  };
};
