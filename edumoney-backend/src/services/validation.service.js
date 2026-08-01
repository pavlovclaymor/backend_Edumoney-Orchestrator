import User from '../models/user.model.js';
import Merchant from '../models/merchant.model.js';
import School from '../models/school.model.js';

/**
 * Service to handle cross-model uniqueness validations
 */
class ValidationService {
  /**
   * Checks if an email is already in use by any of the 3 entities
   * @param {string} email - The email to check
   * @param {string} excludeId - ID to exclude from search (for updates)
   * @returns {Promise<boolean>} - True if email is taken, false otherwise
   */
  async isEmailTaken(email, excludeId = null) {
    if (!email) return false;

    const emailQuery = { email: email.toLowerCase() };
    const excludeQuery = excludeId ? { _id: { $ne: excludeId } } : {};

    const [user, merchant, school] = await Promise.all([
      User.findOne({ ...emailQuery, ...excludeQuery }),
      Merchant.findOne({ ...emailQuery, ...excludeQuery }),
      School.findOne({ ...emailQuery, ...excludeQuery }),
    ]);

    return !!(user || merchant || school);
  }

  /**
   * Checks if a NIF is already in use by Merchant or School
   * @param {string} nif - The NIF to check
   * @param {string} excludeId - ID to exclude from search (for updates)
   * @returns {Promise<boolean>} - True if NIF is taken, false otherwise
   */
  async isNifTaken(nif, excludeId = null) {
    if (!nif) return false;

    const nifQuery = { nif };
    const excludeQuery = excludeId ? { _id: { $ne: excludeId } } : {};

    const [merchant, school] = await Promise.all([
      Merchant.findOne({ ...nifQuery, ...excludeQuery }),
      School.findOne({ ...nifQuery, ...excludeQuery }),
    ]);

    return !!(merchant || school);
  }
}

export default new ValidationService();
