/**
 * Data Population Utilities
 * Handles role-based data filtering and population
 */

/**
 * Check if user can access a specific field
 * @param {string} field - Field name
 * @param {string} userRole - User's role
 * @param {string} targetUserType - Type of user being accessed
 * @returns {boolean} True if user can access the field
 */
function canAccessField(field, userRole, targetUserType) {
  // Define field access matrix
  const fieldAccess = {
    // Basic info accessible to all authenticated users
    basic: ['id', 'name', 'phone', 'email', 'externalId'],
    
    // Sensitive info only for staff/admin
    sensitive: ['password', 'internalNotes', 'adminComments'],
    
    // Driver-specific fields
    driver: ['vehicleType', 'carPlate', 'carModel', 'carColor', 'rating', 'available', 'lastKnownLocation'],
    
    // Staff-specific fields
    staff: ['username', 'fullName'],
    
    // Admin-specific fields
    admin: ['username', 'fullName']
  };

  // Service role can access all fields
  if (userRole === 'service') {
    return true;
  }

  // Admin can access all fields
  if (userRole === 'admin') {
    return true;
  }

  // Staff can access most fields except sensitive ones
  if (userRole === 'staff') {
    return !fieldAccess.sensitive.includes(field);
  }

  // Drivers can access basic info and driver-specific fields
  if (userRole === 'driver') {
    return fieldAccess.basic.includes(field) || fieldAccess.driver.includes(field);
  }

  // Passengers can access basic info
  if (userRole === 'passenger') {
    return fieldAccess.basic.includes(field);
  }

  // Default: deny access
  return false;
}

/**
 * Populate basic info for a user based on role
 * @param {Object} user - User object
 * @param {string} userRole - Requesting user's role
 * @param {string} targetUserType - Type of user being accessed
 * @returns {Object} Filtered user object
 */
function populateBasicInfo(user, userRole, targetUserType) {
  if (!user || typeof user !== 'object') {
    return user;
  }

  const filteredUser = {};
  
  // Always include basic fields
  const basicFields = ['id', 'name', 'phone', 'email', 'externalId'];
  basicFields.forEach(field => {
    if (user[field] !== undefined && canAccessField(field, userRole, targetUserType)) {
      filteredUser[field] = user[field];
    }
  });

  // Add role-specific fields
  if (targetUserType === 'driver' && canAccessField('vehicleType', userRole, targetUserType)) {
    if (user.vehicleType) filteredUser.vehicleType = user.vehicleType;
    if (user.carPlate) filteredUser.carPlate = user.carPlate;
    if (user.carModel) filteredUser.carModel = user.carModel;
    if (user.carColor) filteredUser.carColor = user.carColor;
    if (user.rating !== undefined) filteredUser.rating = user.rating;
    if (user.available !== undefined) filteredUser.available = user.available;
    if (user.lastKnownLocation) filteredUser.lastKnownLocation = user.lastKnownLocation;
  }

  if (targetUserType === 'staff' && canAccessField('username', userRole, targetUserType)) {
    if (user.username) filteredUser.username = user.username;
    if (user.fullName) filteredUser.fullName = user.fullName;
  }

  if (targetUserType === 'admin' && canAccessField('username', userRole, targetUserType)) {
    if (user.username) filteredUser.username = user.username;
    if (user.fullName) filteredUser.fullName = user.fullName;
  }

  // Add timestamps if accessible
  if (canAccessField('createdAt', userRole, targetUserType) && user.createdAt) {
    filteredUser.createdAt = user.createdAt;
  }
  if (canAccessField('updatedAt', userRole, targetUserType) && user.updatedAt) {
    filteredUser.updatedAt = user.updatedAt;
  }

  return filteredUser;
}

/**
 * Populate basic info for multiple users
 * @param {Array} users - Array of user objects
 * @param {string} userRole - Requesting user's role
 * @param {string} targetUserType - Type of users being accessed
 * @returns {Array} Array of filtered user objects
 */
function populateBasicInfoBatch(users, userRole, targetUserType) {
  if (!Array.isArray(users)) {
    return users;
  }

  return users.map(user => populateBasicInfo(user, userRole, targetUserType));
}

module.exports = {
  canAccessField,
  populateBasicInfo,
  populateBasicInfoBatch
};