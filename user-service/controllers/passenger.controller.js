/**
 * Passenger Controller
 * Handles passenger-related operations
 */

const { UserServicePassenger } = require('../models/userModels');
const { 
  hashPassword, 
  comparePassword, 
  generateToken,
  isValidEmail,
  isValidPhone,
  getPaginationParams,
  formatPaginationResponse,
  generateExternalId
} = require('../utils/helpers');
const { populateBasicInfo, populateBasicInfoBatch } = require('../utils/populate');

class PassengerController {
  /**
   * Create a new passenger
   */
  async createPassenger(req, res) {
    try {
      const { name, phone, email, password, emergencyContacts } = req.body;

      // Validation
      if (!name || !phone || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Name, phone, and password are required'
        });
      }

      if (!isValidPhone(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number',
          message: 'Please provide a valid phone number'
        });
      }

      if (email && !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email',
          message: 'Please provide a valid email address'
        });
      }

      // Check if passenger already exists
      const existingPassenger = await UserServicePassenger.findOne({
        $or: [{ phone }, { email: email || '' }]
      });

      if (existingPassenger) {
        return res.status(409).json({
          success: false,
          error: 'Passenger already exists',
          message: 'A passenger with this phone or email already exists'
        });
      }

      // Create passenger
      const hashedPassword = await hashPassword(password);
      const externalId = generateExternalId('PASS');

      const passenger = await UserServicePassenger.create({
        name,
        phone,
        email: email || undefined,
        password: hashedPassword,
        externalId,
        emergencyContacts: emergencyContacts || []
      });

      // Generate token
      const token = generateToken({
        id: passenger.id,
        name: passenger.name,
        phone: passenger.phone,
        email: passenger.email,
        role: 'passenger',
        type: 'passenger'
      });

      res.status(201).json({
        success: true,
        message: 'Passenger created successfully',
        data: {
          passenger: populateBasicInfo(passenger, 'passenger', 'passenger'),
          token
        }
      });
    } catch (error) {
      console.error('Create passenger error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create passenger'
      });
    }
  }

  /**
   * Authenticate passenger
   */
  async authenticatePassenger(req, res) {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing credentials',
          message: 'Phone and password are required'
        });
      }

      // Find passenger
      const passenger = await UserServicePassenger.findOne({ phone });
      if (!passenger) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid phone or password'
        });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, passenger.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid phone or password'
        });
      }

      // Generate token
      const token = generateToken({
        id: passenger.id,
        name: passenger.name,
        phone: passenger.phone,
        email: passenger.email,
        role: 'passenger',
        type: 'passenger'
      });

      res.json({
        success: true,
        message: 'Authentication successful',
        data: {
          passenger: populateBasicInfo(passenger, 'passenger', 'passenger'),
          token
        }
      });
    } catch (error) {
      console.error('Authenticate passenger error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to authenticate passenger'
      });
    }
  }

  /**
   * Get passenger by ID
   */
  async getPassengerById(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role || 'anonymous';

      const passenger = await UserServicePassenger.findById(id);
      if (!passenger) {
        return res.status(404).json({
          success: false,
          error: 'Passenger not found',
          message: 'No passenger found with the provided ID'
        });
      }

      res.json({
        success: true,
        data: populateBasicInfo(passenger, userRole, 'passenger')
      });
    } catch (error) {
      console.error('Get passenger by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve passenger'
      });
    }
  }

  /**
   * Get passenger by external ID
   */
  async getPassengerByExternalId(req, res) {
    try {
      const { externalId } = req.params;
      const userRole = req.user?.role || 'anonymous';

      const passenger = await UserServicePassenger.findOne({ externalId });
      if (!passenger) {
        return res.status(404).json({
          success: false,
          error: 'Passenger not found',
          message: 'No passenger found with the provided external ID'
        });
      }

      res.json({
        success: true,
        data: populateBasicInfo(passenger, userRole, 'passenger')
      });
    } catch (error) {
      console.error('Get passenger by external ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve passenger'
      });
    }
  }

  /**
   * List passengers
   */
  async listPassengers(req, res) {
    try {
      const { page, limit, offset } = getPaginationParams(req.query);
      const userRole = req.user?.role || 'anonymous';

      const query = {};
      
      // Add search filters if provided
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const total = await UserServicePassenger.countDocuments(query);
      const passengers = await UserServicePassenger.find(query)
        .skip(offset)
        .limit(limit)
        .sort({ createdAt: -1 });

      const filteredPassengers = populateBasicInfoBatch(passengers, userRole, 'passenger');

      res.json(formatPaginationResponse(filteredPassengers, page, limit, total));
    } catch (error) {
      console.error('List passengers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve passengers'
      });
    }
  }

  /**
   * Update passenger
   */
  async updatePassenger(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if user can update this passenger
      if (userRole !== 'admin' && userRole !== 'staff' && userId !== id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only update your own profile'
        });
      }

      const updateData = { ...req.body };
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData._id;
      delete updateData.externalId;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const passenger = await UserServicePassenger.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!passenger) {
        return res.status(404).json({
          success: false,
          error: 'Passenger not found',
          message: 'No passenger found with the provided ID'
        });
      }

      res.json({
        success: true,
        message: 'Passenger updated successfully',
        data: populateBasicInfo(passenger, userRole, 'passenger')
      });
    } catch (error) {
      console.error('Update passenger error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update passenger'
      });
    }
  }

  /**
   * Delete passenger
   */
  async deletePassenger(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;

      // Only admin and staff can delete passengers
      if (userRole !== 'admin' && userRole !== 'staff') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Only admin and staff can delete passengers'
        });
      }

      const passenger = await UserServicePassenger.findByIdAndDelete(id);
      if (!passenger) {
        return res.status(404).json({
          success: false,
          error: 'Passenger not found',
          message: 'No passenger found with the provided ID'
        });
      }

      res.json({
        success: true,
        message: 'Passenger deleted successfully'
      });
    } catch (error) {
      console.error('Delete passenger error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to delete passenger'
      });
    }
  }

  /**
   * Get passengers by IDs (batch operation)
   */
  async getPassengersByIds(req, res) {
    try {
      const { ids } = req.body;
      const userRole = req.user?.role || 'anonymous';

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'IDs array is required'
        });
      }

      const passengers = await UserServicePassenger.find({ _id: { $in: ids } });
      const filteredPassengers = populateBasicInfoBatch(passengers, userRole, 'passenger');

      res.json({
        success: true,
        data: filteredPassengers
      });
    } catch (error) {
      console.error('Get passengers by IDs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve passengers'
      });
    }
  }

  /**
   * Get passenger statistics
   */
  async getPassengerStats(req, res) {
    try {
      const userRole = req.user?.role;

      // Only admin and staff can view statistics
      if (userRole !== 'admin' && userRole !== 'staff') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Only admin and staff can view statistics'
        });
      }

      const totalPassengers = await UserServicePassenger.countDocuments();
      const recentPassengers = await UserServicePassenger.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      res.json({
        success: true,
        data: {
          totalPassengers,
          recentPassengers,
          period: '30 days'
        }
      });
    } catch (error) {
      console.error('Get passenger stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve passenger statistics'
      });
    }
  }
}

module.exports = new PassengerController();