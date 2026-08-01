import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';

/**
 * Settings Service
 * Handles all settings-related operations for merchants and schools.
 * Manages embedded settings, password changes, and validation.
 */

/**
 * Validates password strength
 * Requirements:
 *  - Minimum 6 characters
 *  - At least one uppercase letter
 *  - At least one number
 */
export const validatePasswordStrength = (password) => {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Senha deve conter pelo menos 6 caracteres' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Senha deve conter pelo menos uma letra maiúscula' };
  }

  if (!/\d/.test(password)) {
    return { valid: false, error: 'Senha deve conter pelo menos um número' };
  }

  return { valid: true };
};

/**
 * Get settings for a merchant
 */
export const getMerchantSettings = async (merchantId) => {
  try {
    const merchant = await Merchant.findById(merchantId).select(
      'preferences notificationSettings securitySettings',
    );
    if (!merchant) {
      throw new Error('Comerciante não encontrado');
    }
    return {
      preferences: merchant.preferences,
      notificationSettings: merchant.notificationSettings,
      securitySettings: merchant.securitySettings,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get settings for a school
 */
export const getSchoolSettings = async (schoolId) => {
  try {
    const school = await School.findById(schoolId).select(
      'preferences notificationSettings securitySettings',
    );
    if (!school) {
      throw new Error('Escola não encontrada');
    }
    return {
      preferences: school.preferences,
      notificationSettings: school.notificationSettings,
      securitySettings: school.securitySettings,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Update merchant settings
 */
export const updateMerchantSettings = async (merchantId, updates) => {
  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      throw new Error('Comerciante não encontrado');
    }

    // Validate and merge settings
    if (updates.preferences) {
      merchant.preferences = { ...merchant.preferences, ...updates.preferences };
    }
    if (updates.notificationSettings) {
      merchant.notificationSettings = {
        ...merchant.notificationSettings,
        ...updates.notificationSettings,
      };
    }

    await merchant.save();
    return {
      preferences: merchant.preferences,
      notificationSettings: merchant.notificationSettings,
      securitySettings: merchant.securitySettings,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Update school settings
 */
export const updateSchoolSettings = async (schoolId, updates) => {
  try {
    const school = await School.findById(schoolId);
    if (!school) {
      throw new Error('Escola não encontrada');
    }

    // Validate and merge settings
    if (updates.preferences) {
      school.preferences = { ...school.preferences, ...updates.preferences };
    }
    if (updates.notificationSettings) {
      school.notificationSettings = {
        ...school.notificationSettings,
        ...updates.notificationSettings,
      };
    }

    await school.save();
    return {
      preferences: school.preferences,
      notificationSettings: school.notificationSettings,
      securitySettings: school.securitySettings,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Change password for a merchant
 */
export const changeMerchantPassword = async (merchantId, oldPassword, newPassword) => {
  try {
    const merchant = await Merchant.findById(merchantId).select('+password');
    if (!merchant) {
      throw new Error('Comerciante não encontrado');
    }

    // Verify old password
    const isPasswordValid = await merchant.matchPassword(oldPassword);
    if (!isPasswordValid) {
      throw new Error('Senha atual inválida');
    }

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if new password is different from old
    if (oldPassword === newPassword) {
      throw new Error('Nova senha deve ser diferente da senha atual');
    }

    // Update password
    merchant.password = newPassword;
    merchant.securitySettings.passwordChangedAt = new Date();
    await merchant.save();

    return { message: 'Senha alterada com sucesso' };
  } catch (error) {
    throw error;
  }
};

/**
 * Change password for a school
 */
export const changeSchoolPassword = async (schoolId, oldPassword, newPassword) => {
  try {
    const school = await School.findById(schoolId).select('+password');
    if (!school) {
      throw new Error('Escola não encontrada');
    }

    // Verify old password
    const isPasswordValid = await school.matchPassword(oldPassword);
    if (!isPasswordValid) {
      throw new Error('Senha atual inválida');
    }

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if new password is different from old
    if (oldPassword === newPassword) {
      throw new Error('Nova senha deve ser diferente da senha atual');
    }

    // Update password
    school.password = newPassword;
    school.securitySettings.passwordChangedAt = new Date();
    await school.save();

    return { message: 'Senha alterada com sucesso' };
  } catch (error) {
    throw error;
  }
};
