/**
 * Admin Routes
 * Defines API endpoints for admin operations
 */

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const authenticate = require('../middleware/auth');
const { 
  requireAdmin,
  requireStaff,
  filterResponseData,
  validateExternalServiceAccess
} = require('../middleware/rbac');

// ===== ADMIN ONLY ROUTES =====

// Create admin (admin only)
router.post('/', 
  authenticate(), 
  requireAdmin(), 
  adminController.createAdmin
);

// Authenticate admin
router.post('/auth', adminController.authenticateAdmin);

// Get admin by ID (admin only)
router.get('/:id', 
  authenticate(), 
  requireAdmin(), 
  filterResponseData('admin'),
  adminController.getAdminById
);

module.exports = router;