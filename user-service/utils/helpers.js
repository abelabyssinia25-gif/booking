/**
 * Helper utilities for the user service
 */

const { hashPassword, comparePassword } = require('./password');
const { generateToken } = require('./jwt');

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function isValidPhone(phone) {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Get pagination parameters from request query
 * @param {Object} query - Request query object
 * @returns {Object} Pagination parameters
 */
function getPaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Format pagination response
 * @param {Object} data - Response data
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Formatted pagination response
 */
function formatPaginationResponse(data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Generate external ID for user
 * @param {string} prefix - Prefix for the ID (e.g., 'PASS', 'DRV')
 * @returns {string} Generated external ID
 */
function generateExternalId(prefix = 'USR') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  isValidEmail,
  isValidPhone,
  getPaginationParams,
  formatPaginationResponse,
  generateExternalId
};