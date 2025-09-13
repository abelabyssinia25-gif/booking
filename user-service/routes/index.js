/**
 * User Service Integration
 * Provides user management functionality for the booking service
 */

const express = require('express');
const router = express.Router();

// Import user service modules
const passengerRoutes = require('./passenger.routes');
const driverRoutes = require('./driver.routes');
const adminRoutes = require('./admin.routes');

// ===== USER SERVICE ROUTES =====

// Passenger routes
router.use('/passenger', passengerRoutes);

// Driver routes  
router.use('/driver', driverRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// ===== EXTERNAL SERVICE INTEGRATION ROUTES =====

// These routes are specifically designed for external service integration
// They provide simplified access patterns for the booking service

// Get passenger info for external services
router.get('/passenger/:id', 
  require('../middleware/rbac').validateExternalServiceAccess(),
  require('../middleware/auth')(),
  require('../middleware/rbac').canAccessUserType('passenger'),
  require('../middleware/rbac').filterResponseData('passenger'),
  require('../controllers/passenger.controller').getPassengerById
);

// Get driver info for external services
router.get('/driver/:id', 
  require('../middleware/rbac').validateExternalServiceAccess(),
  require('../middleware/auth')(),
  require('../middleware/rbac').canAccessUserType('driver'),
  require('../middleware/rbac').filterResponseData('driver'),
  require('../controllers/driver.controller').getDriverById
);

// Get user info by external ID for external services
router.get('/passenger/external/:externalId', 
  require('../middleware/rbac').validateExternalServiceAccess(),
  require('../middleware/auth')(),
  require('../middleware/rbac').canAccessUserType('passenger'),
  require('../middleware/rbac').filterResponseData('passenger'),
  require('../controllers/passenger.controller').getPassengerByExternalId
);

router.get('/driver/external/:externalId', 
  require('../middleware/rbac').validateExternalServiceAccess(),
  require('../middleware/auth')(),
  require('../middleware/rbac').canAccessUserType('driver'),
  require('../middleware/rbac').filterResponseData('driver'),
  require('../controllers/driver.controller').getDriverByExternalId
);

// Batch operations for external services
router.post('/passengers/batch', 
  require('../middleware/rbac').validateExternalServiceAccess(),
  require('../middleware/auth')(),
  require('../middleware/rbac').requireStaff(),
  require('../middleware/rbac').filterResponseData('passenger'),
  require('../controllers/passenger.controller').getPassengersByIds
);

router.post('/drivers/batch', 
  require('../middleware/rbac').validateExternalServiceAccess(),
  require('../middleware/auth')(),
  require('../middleware/rbac').requireStaff(),
  require('../middleware/rbac').filterResponseData('driver'),
  require('../controllers/driver.controller').getDriversByIds
);

// ===== HEALTH CHECK ROUTES =====

// Service health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'user-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      roleBasedAccess: true,
      externalServiceIntegration: true,
      dataFiltering: true,
      batchOperations: true
    }
  });
});

// Service info
router.get('/info', (req, res) => {
  res.json({
    success: true,
    service: 'user-service',
    description: 'External User Service for Booking Service Integration',
    version: '2.0.0',
    endpoints: {
      passengers: '/api/passenger',
      drivers: '/api/driver', 
      admins: '/api/admin',
      external: {
        passenger: '/api/passenger/:id',
        driver: '/api/driver/:id',
        batch: {
          passengers: '/api/passengers/batch',
          drivers: '/api/drivers/batch'
        }
      }
    },
    authentication: {
      methods: ['JWT', 'Service-to-Service'],
      headers: {
        jwt: 'Authorization: Bearer <token>',
        service: 'X-Service-Token: <token>, X-Service-Name: <service>'
      }
    },
    roleBasedAccess: {
      passenger: 'Can access own data and basic driver info',
      driver: 'Can access own data and basic passenger info', 
      staff: 'Can access passenger, driver, and staff data',
      admin: 'Can access all user data',
      service: 'Can access filtered data based on service type'
    }
  });
});

module.exports = router;