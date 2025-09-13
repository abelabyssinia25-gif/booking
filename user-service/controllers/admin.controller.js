/**
 * Admin Controller
 * Handles admin-related operations
 */

const { UserServiceAdmin } = require('../models/userModels');
const { 
  hashPassword, 
  comparePassword, 
  generateToken,
  isValidEmail,
  getPaginationParams,
  formatPaginationResponse,
  generateExternalId
} = require('../utils/helpers');
const { populateBasicInfo, populateBasicInfoBatch } = require('../utils/populate');

class AdminController {
  /**
   * Create a new admin
   */
  async createAdmin(req, res) {
    try {
      const { fullName, username, password } = req.body;

      // Validation
      if (!fullName || !username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Full name, username, and password are required'
        });
      }

      // Check if admin already exists
      const existingAdmin = await UserServiceAdmin.findOne({ username });
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          error: 'Admin already exists',
          message: 'An admin with this username already exists'
        });
      }

      // Create admin
      const hashedPassword = await hashPassword(password);
      const externalId = generateExternalId('ADM');

      const admin = await UserServiceAdmin.create({
        fullName,
        username,
        password: hashedPassword,
        externalId
      });

      // Generate token
      const token = generateToken({
        id: admin.id,
        fullName: admin.fullName,
        username: admin.username,
        role: 'admin',
        type: 'admin'
      });

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        data: {
          admin: populateBasicInfo(admin, 'admin', 'admin'),
          token
        }
      });
    } catch (error) {
      console.error('Create admin error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create admin'
      });
    }
  }

  /**
   * Authenticate admin
   */
  async authenticateAdmin(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing credentials',
          message: 'Username and password are required'
        });
      }

      // Find admin
      const admin = await UserServiceAdmin.findOne({ username });
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }

      // Generate token
      const token = generateToken({
        id: admin.id,
        fullName: admin.fullName,
        username: admin.username,
        role: 'admin',
        type: 'admin'
      });

      res.json({
        success: true,
        message: 'Authentication successful',
        data: {
          admin: populateBasicInfo(admin, 'admin', 'admin'),
          token
        }
      });
    } catch (error) {
      console.error('Authenticate admin error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to authenticate admin'
      });
    }
  }

  /**
   * Get admin by ID
   */
  async getAdminById(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role || 'anonymous';

      const admin = await UserServiceAdmin.findById(id);
      if (!admin) {
        return res.status(404).json({
          success: false,
          error: 'Admin not found',
          message: 'No admin found with the provided ID'
        });
      }

      res.json({
        success: true,
        data: populateBasicInfo(admin, userRole, 'admin')
      });
    } catch (error) {
      console.error('Get admin by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve admin'
      });
    }
  }
}

module.exports = new AdminController();