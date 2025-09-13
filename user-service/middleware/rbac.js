/**
 * Role-Based Access Control (RBAC) Middleware
 * Handles role-based permissions for external service access
 */

const { populateBasicInfo, canAccessField } = require('../utils/populate');

/**
 * Check if user has required role
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid authentication token'
        });
      }

      const userRole = req.user.role;
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userRole}`
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to verify user permissions'
      });
    }
  };
};

/**
 * Check if user has required permission
 * @param {string} permission - Permission string (e.g., 'passenger:read', 'driver:update')
 * @returns {Function} Express middleware function
 */
const requirePermissions = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid authentication token'
        });
      }

      const userRole = req.user.role;
      
      // Define permission matrix based on roles
      const permissionMatrix = {
        admin: ['*'], // Admin has all permissions
        staff: [
          'passenger:read', 'passenger:update', 'passenger:delete',
          'driver:read', 'driver:update', 'driver:delete', 'driver:approve', 'driver:documents:approve',
          'staff:read', 'staff:update', 'staff:delete',
          'user:read', 'role:read', 'permission:read'
        ],
        driver: [
          'passenger:read', 'driver:read', 'driver:update'
        ],
        passenger: [
          'passenger:read', 'passenger:update', 'passenger:delete'
        ]
      };

      const userPermissions = permissionMatrix[userRole] || [];
      
      // Check if user has the required permission
      const hasPermission = userPermissions.includes('*') || userPermissions.includes(permission);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: `Access denied. Required permission: ${permission}. Your role: ${userRole}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to verify user permissions'
      });
    }
  };
};

/**
 * Check if user can access specific user type data
 * @param {string} targetUserType - Type of user being accessed (passenger, driver, staff, admin)
 * @returns {Function} Express middleware function
 */
const canAccessUserType = (targetUserType) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid authentication token'
        });
      }

      const userRole = req.user.role;
      
      // Define access matrix
      const accessMatrix = {
        passenger: ['passenger', 'driver'], // Passengers can access passenger and driver data
        driver: ['passenger', 'driver'], // Drivers can access passenger and driver data
        staff: ['passenger', 'driver', 'staff'], // Staff can access passenger, driver, and staff data
        admin: ['passenger', 'driver', 'staff', 'admin'] // Admins can access all data
      };

      const allowedUserTypes = accessMatrix[userRole] || [];
      
      if (!allowedUserTypes.includes(targetUserType)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: `You cannot access ${targetUserType} data. Your role: ${userRole}`
        });
      }

      next();
    } catch (error) {
      console.error('User type access check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to verify user type access permissions'
      });
    }
  };
};

/**
 * Check if user can access their own data or has admin privileges
 * @returns {Function} Express middleware function
 */
const canAccessOwnDataOrAdmin = () => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid authentication token'
        });
      }

      const userRole = req.user.role;
      const userId = req.user.id;
      const requestedUserId = req.params.id;

      // Admins can access any user's data
      if (userRole === 'admin') {
        return next();
      }

      // Users can only access their own data
      if (userId !== requestedUserId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only access your own data'
        });
      }

      next();
    } catch (error) {
      console.error('Own data access check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to verify data access permissions'
      });
    }
  };
};

/**
 * Check if user can perform admin operations
 * @returns {Function} Express middleware function
 */
const requireAdmin = () => {
  return requireRole(['admin']);
};

/**
 * Check if user can perform staff operations
 * @returns {Function} Express middleware function
 */
const requireStaff = () => {
  return requireRole(['staff', 'admin']);
};

/**
 * Check if user can perform driver operations
 * @returns {Function} Express middleware function
 */
const requireDriver = () => {
  return requireRole(['driver', 'staff', 'admin']);
};

/**
 * Check if user can perform passenger operations
 * @returns {Function} Express middleware function
 */
const requirePassenger = () => {
  return requireRole(['passenger', 'staff', 'admin']);
};

/**
 * Add role-based data filtering to response
 * @param {string} targetUserType - Type of user being accessed
 * @returns {Function} Express middleware function
 */
const filterResponseData = (targetUserType) => {
  return (req, res, next) => {
    try {
      // Store original json method
      const originalJson = res.json;

      // Override json method to filter data
      res.json = function(data) {
        if (data && data.success && data.data) {
          const userRole = req.user?.role || 'anonymous';
          
          // Filter single object
          if (!Array.isArray(data.data)) {
            data.data = populateBasicInfo(data.data, userRole, targetUserType);
          } else {
            // Filter array of objects
            data.data = data.data.map(item => populateBasicInfo(item, userRole, targetUserType));
          }
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Response filtering error:', error);
      next();
    }
  };
};

/**
 * Validate external service access
 * @returns {Function} Express middleware function
 */
const validateExternalServiceAccess = () => {
  return (req, res, next) => {
    try {
      const serviceToken = req.headers['x-service-token'];
      const serviceName = req.headers['x-service-name'];

      // Check if request is from external service
      if (serviceToken && serviceName) {
        const validServices = ['booking-service', 'ride-service', 'payment-service'];
        const validTokens = process.env.SERVICE_TOKENS ? process.env.SERVICE_TOKENS.split(',') : [];

        if (validServices.includes(serviceName) && validTokens.includes(serviceToken)) {
          // Set service user context
          req.user = {
            role: 'service',
            serviceName: serviceName,
            type: 'external-service'
          };
          return next();
        }
      }

      // Fallback to regular authentication
      next();
    } catch (error) {
      console.error('External service validation error:', error);
      next();
    }
  };
};

module.exports = {
  requireRole,
  canAccessUserType,
  canAccessOwnDataOrAdmin,
  requireAdmin,
  requireStaff,
  requireDriver,
  requirePassenger,
  requirePermissions,
  filterResponseData,
  validateExternalServiceAccess
};