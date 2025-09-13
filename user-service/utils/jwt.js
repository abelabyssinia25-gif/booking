const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 * @param {Object} payload - User data to include in token
 * @returns {string} JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Generate token for phone-verified user
 * @param {Object} user - User object with id and phone
 * @returns {string} JWT token
 */
function generateUserToken(user) {
  return generateToken({
    id: user.id,
    phone: user.phone,
    type: 'user',
    verified: true
  });
}

module.exports = {
  generateToken,
  verifyToken,
  generateUserToken
};