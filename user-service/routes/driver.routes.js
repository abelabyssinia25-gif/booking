/**
 * Driver Routes
 * Defines API endpoints for driver operations
 */

const express = require('express');
const router = express.Router();

const driverController = require('../controllers/driver.controller');
const authenticate = require('../middleware/auth');
const { 
  requireDriver, 
  requireStaff, 
  requireAdmin,
  requirePassenger,
  canAccessUserType,
  filterResponseData,
  validateExternalServiceAccess
} = require('../middleware/rbac');

// ===== PUBLIC ROUTES =====

// Create driver (public registration)
router.post('/', driverController.createDriver);

// Authenticate driver
router.post('/auth', driverController.authenticateDriver);

// Get available drivers (for booking service)
router.get('/available', 
  validateExternalServiceAccess(),
  authenticate(), 
  filterResponseData('driver'),
  driverController.getAvailableDrivers
);

// ===== PROTECTED ROUTES =====

// Get driver by ID (role-based access)
router.get('/:id', 
  validateExternalServiceAccess(),
  authenticate(), 
  canAccessUserType('driver'),
  filterResponseData('driver'),
  driverController.getDriverById
);

// Get driver by external ID (role-based access)
router.get('/external/:externalId', 
  validateExternalServiceAccess(),
  authenticate(), 
  canAccessUserType('driver'),
  filterResponseData('driver'),
  driverController.getDriverByExternalId
);

// ===== STAFF/ADMIN ONLY ROUTES =====

// List drivers (staff/admin only)
router.get('/', 
  authenticate(), 
  requireStaff(), 
  filterResponseData('driver'),
  driverController.listDrivers
);

// Update driver (own data or admin)
router.put('/:id', 
  authenticate(), 
  requireDriver(), 
  driverController.updateDriver
);

// Delete driver (staff/admin only)
router.delete('/:id', 
  authenticate(), 
  requireStaff(), 
  driverController.deleteDriver
);

// Batch get drivers by IDs (staff/admin only)
router.post('/batch', 
  authenticate(), 
  requireStaff(), 
  filterResponseData('driver'),
  driverController.getDriversByIds
);

// Update driver rating (passenger/staff/admin)
router.put('/:id/rating', 
  authenticate(), 
  requirePassenger(), 
  driverController.updateDriverRating
);

// Get driver statistics (staff/admin only)
router.get('/stats/overview', 
  authenticate(), 
  requireStaff(), 
  driverController.getDriverStats
);

module.exports = router;