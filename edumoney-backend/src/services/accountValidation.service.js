import User from '../models/user.model.js';
import ServicePrice from '../models/servicePrice.model.js';

/**
 * Account Validation Service
 * Centralized service for account activation and service validation.
 * Ensures consistent validation logic across the application.
 */

/**
 * Validates if a student account is fully activated.
 * @param {String} userId - User ID
 * @returns {Promise<Object>} { activated: boolean, message: string, user: Object }
 */
export const validateAccountActivation = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return {
        activated: false,
        message: 'Utilizador não encontrado',
      };
    }

    const isActivated = user.isAccountFullyActivated();

    if (isActivated) {
      return {
        activated: false,
        message:
          'A sua conta ainda não está completamente ativada. Altere a sua palavra-passe e configure o seu PIN de segurança.',
        user,
      };
    }

    return {
      activated: true,
      message: 'Conta ativada com sucesso',
      user,
    };
  } catch (error) {
    console.error('[AccountValidation] Error validating account activation:', error);
    return {
      activated: false,
      message: 'Erro ao validar ativação da conta',
    };
  }
};

/**
 * Validates if a service is active and available.
 * @param {String} schoolId - School ID
 * @param {String} tipoServico - Service type (CERTIFICADO, DECLARACAO_COM_NOTA, DECLARACAO_SEM_NOTA, FOLHA_PROVA)
 * @returns {Promise<Object>} { active: boolean, message: string, service: Object }
 */
export const validateServiceActive = async (schoolId, tipoServico) => {
  try {
    const service = await ServicePrice.findOne({ schoolId, tipoServico });

    if (!service) {
      return {
        active: false,
        message: 'Serviço não encontrado',
      };
    }

    if (!service.active) {
      return {
        active: false,
        message: 'Este serviço ainda não foi activado pela instituição',
        service,
      };
    }

    return {
      active: true,
      message: 'Serviço disponível',
      service,
    };
  } catch (error) {
    console.error('[AccountValidation] Error validating service:', error);
    return {
      active: false,
      message: 'Erro ao validar serviço',
    };
  }
};

/**
 * Validates if there is sufficient stock for a service.
 * @param {String} schoolId - School ID
 * @param {String} tipoServico - Service type
 * @returns {Promise<Object>} { hasStock: boolean, message: string, service: Object }
 */
export const validateStockAvailable = async (schoolId, tipoServico) => {
  try {
    const service = await ServicePrice.findOne({ schoolId, tipoServico });

    if (!service) {
      return {
        hasStock: false,
        message: 'Serviço não encontrado',
      };
    }

    // Check if quantidade (stock) is greater than 0
    if (!service.quantidade || service.quantidade <= 0) {
      return {
        hasStock: false,
        message: 'A instituição não possui stock suficiente para este serviço no momento',
        service,
      };
    }

    return {
      hasStock: true,
      message: 'Stock disponível',
      service,
    };
  } catch (error) {
    console.error('[AccountValidation] Error validating stock:', error);
    return {
      hasStock: false,
      message: 'Erro ao validar stock',
    };
  }
};

/**
 * Comprehensive validation for RUPE creation.
 * Validates account activation, service active, and stock availability all at once.
 * @param {String} userId - User ID
 * @param {String} schoolId - School ID
 * @param {String} tipoServico - Service type
 * @returns {Promise<Object>} { valid: boolean, errors: Array<string>, data: Object }
 */
export const validateRupeCreation = async (userId, schoolId, tipoServico) => {
  try {
    const errors = [];

    // 1. Validate account activation
    const accountCheck = await validateAccountActivation(userId);
    if (!accountCheck.activated) {
      errors.push(accountCheck.message);
    }

    // 2. Validate service is active
    const serviceCheck = await validateServiceActive(schoolId, tipoServico);
    if (!serviceCheck.active) {
      errors.push(serviceCheck.message);
    }

    // 3. Validate stock availability
    const stockCheck = await validateStockAvailable(schoolId, tipoServico);
    if (!stockCheck.hasStock) {
      errors.push(stockCheck.message);
    }

    return {
      valid: errors.length === 0,
      errors,
      data: {
        account: accountCheck,
        service: serviceCheck,
        stock: stockCheck,
      },
    };
  } catch (error) {
    console.error('[AccountValidation] Error in comprehensive RUPE validation:', error);
    return {
      valid: false,
      errors: ['Erro ao validar operação'],
      data: null,
    };
  }
};
