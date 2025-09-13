/**
 * Passenger Routes
 * Defines API endpoints for passenger operations
 */

const express = require('express');
const router = express.Router();

const passengerController = require('../controllers/passenger.controller');
const authenticate = require('../middleware/auth');
const { 
  requirePassenger, 
  requireStaff, 
  requireAdmin,
  canAccessUserType,
  filterResponseData,
  validateExternalServiceAccess
} = require('../middleware/rbac');

// ===== PUBLIC ROUTES =====

// Create passenger (public registration)
router.post('/', passengerController.createPassenger);

// Authenticate passenger
router.post('/auth', passengerController.authenticatePassenger);

// ===== PROTECTED ROUTES =====

// Get passenger by ID (role-based access)
router.get('/:id', 
  validateExternalServiceAccess(),
  authenticate(), 
  canAccessUserType('passenger'),
  filterResponseData('passenger'),
  passengerController.getPassengerById
);

// Get passenger by external ID (role-based access)
router.get('/external/:externalId', 
  validateExternalServiceAccess(),
  authenticate(), 
  canAccessUserType('passenger'),
  filterResponseData('passenger'),
  passengerController.getPassengerByExternalId
);

// ===== STAFF/ADMIN ONLY ROUTES =====

// List passengers (staff/admin only)
router.get('/', 
  authenticate(), 
  requireStaff(), 
  filterResponseData('passenger'),
  passengerController.listPassengers
);

// Update passenger (own data or admin)
router.put('/:id', 
  authenticate(), 
  requirePassenger(), 
  passengerController.updatePassenger
);

// Delete passenger (staff/admin only)
router.delete('/:id', 
  authenticate(), 
  requireStaff(), 
  passengerController.deletePassenger
);

// Batch get passengers by IDs (staff/admin only)
router.post('/batch', 
  authenticate(), 
  requireStaff(), 
  filterResponseData('passenger'),
  passengerController.getPassengersByIds
);

// Get passenger statistics (staff/admin only)
router.get('/stats/overview', 
  authenticate(), 
  requireStaff(), 
  passengerController.getPassengerStats
);

module.exports = router;