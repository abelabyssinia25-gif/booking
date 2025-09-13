/**
 * Driver Controller
 * Handles driver-related operations
 */

const { UserServiceDriver } = require('../models/userModels');
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

class DriverController {
  /**
   * Create a new driver
   */
  async createDriver(req, res) {
    try {
      const { 
        name, 
        phone, 
        email, 
        password, 
        vehicleType, 
        carPlate, 
        carModel, 
        carColor 
      } = req.body;

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

      // Check if driver already exists
      const existingDriver = await UserServiceDriver.findOne({
        $or: [{ phone }, { email: email || '' }]
      });

      if (existingDriver) {
        return res.status(409).json({
          success: false,
          error: 'Driver already exists',
          message: 'A driver with this phone or email already exists'
        });
      }

      // Create driver
      const hashedPassword = await hashPassword(password);
      const externalId = generateExternalId('DRV');
      const driverId = externalId; // Use external ID as the main ID

      const driver = await UserServiceDriver.create({
        _id: driverId,
        name,
        phone,
        email: email || undefined,
        password: hashedPassword,
        externalId,
        vehicleType: vehicleType || 'mini',
        carPlate: carPlate || undefined,
        carModel: carModel || undefined,
        carColor: carColor || undefined,
        available: false,
        rating: 5.0,
        ratingCount: 0
      });

      // Generate token
      const token = generateToken({
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        role: 'driver',
        type: 'driver'
      });

      res.status(201).json({
        success: true,
        message: 'Driver created successfully',
        data: {
          driver: populateBasicInfo(driver, 'driver', 'driver'),
          token
        }
      });
    } catch (error) {
      console.error('Create driver error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create driver'
      });
    }
  }

  /**
   * Authenticate driver
   */
  async authenticateDriver(req, res) {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing credentials',
          message: 'Phone and password are required'
        });
      }

      // Find driver
      const driver = await UserServiceDriver.findOne({ phone });
      if (!driver) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid phone or password'
        });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, driver.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid phone or password'
        });
      }

      // Generate token
      const token = generateToken({
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        role: 'driver',
        type: 'driver'
      });

      res.json({
        success: true,
        message: 'Authentication successful',
        data: {
          driver: populateBasicInfo(driver, 'driver', 'driver'),
          token
        }
      });
    } catch (error) {
      console.error('Authenticate driver error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to authenticate driver'
      });
    }
  }

  /**
   * Get driver by ID
   */
  async getDriverById(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role || 'anonymous';

      const driver = await UserServiceDriver.findById(id);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found',
          message: 'No driver found with the provided ID'
        });
      }

      res.json({
        success: true,
        data: populateBasicInfo(driver, userRole, 'driver')
      });
    } catch (error) {
      console.error('Get driver by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve driver'
      });
    }
  }

  /**
   * Get driver by external ID
   */
  async getDriverByExternalId(req, res) {
    try {
      const { externalId } = req.params;
      const userRole = req.user?.role || 'anonymous';

      const driver = await UserServiceDriver.findOne({ externalId });
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found',
          message: 'No driver found with the provided external ID'
        });
      }

      res.json({
        success: true,
        data: populateBasicInfo(driver, userRole, 'driver')
      });
    } catch (error) {
      console.error('Get driver by external ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve driver'
      });
    }
  }

  /**
   * List drivers
   */
  async listDrivers(req, res) {
    try {
      const { page, limit, offset } = getPaginationParams(req.query);
      const userRole = req.user?.role || 'anonymous';

      const query = {};
      
      // Add search filters if provided
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { carPlate: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Filter by availability if provided
      if (req.query.available !== undefined) {
        query.available = req.query.available === 'true';
      }

      // Filter by vehicle type if provided
      if (req.query.vehicleType) {
        query.vehicleType = req.query.vehicleType;
      }

      const total = await UserServiceDriver.countDocuments(query);
      const drivers = await UserServiceDriver.find(query)
        .skip(offset)
        .limit(limit)
        .sort({ createdAt: -1 });

      const filteredDrivers = populateBasicInfoBatch(drivers, userRole, 'driver');

      res.json(formatPaginationResponse(filteredDrivers, page, limit, total));
    } catch (error) {
      console.error('List drivers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve drivers'
      });
    }
  }

  /**
   * Get available drivers
   */
  async getAvailableDrivers(req, res) {
    try {
      const { vehicleType } = req.query;
      const userRole = req.user?.role || 'anonymous';

      const query = { available: true };
      
      if (vehicleType) {
        query.vehicleType = vehicleType;
      }

      const drivers = await UserServiceDriver.find(query)
        .select('_id name phone vehicleType carPlate carModel carColor rating lastKnownLocation')
        .sort({ rating: -1 });

      const filteredDrivers = populateBasicInfoBatch(drivers, userRole, 'driver');

      res.json({
        success: true,
        data: filteredDrivers
      });
    } catch (error) {
      console.error('Get available drivers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve available drivers'
      });
    }
  }

  /**
   * Update driver
   */
  async updateDriver(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if user can update this driver
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

      const driver = await UserServiceDriver.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found',
          message: 'No driver found with the provided ID'
        });
      }

      res.json({
        success: true,
        message: 'Driver updated successfully',
        data: populateBasicInfo(driver, userRole, 'driver')
      });
    } catch (error) {
      console.error('Update driver error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update driver'
      });
    }
  }

  /**
   * Delete driver
   */
  async deleteDriver(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;

      // Only admin and staff can delete drivers
      if (userRole !== 'admin' && userRole !== 'staff') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Only admin and staff can delete drivers'
        });
      }

      const driver = await UserServiceDriver.findByIdAndDelete(id);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found',
          message: 'No driver found with the provided ID'
        });
      }

      res.json({
        success: true,
        message: 'Driver deleted successfully'
      });
    } catch (error) {
      console.error('Delete driver error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to delete driver'
      });
    }
  }

  /**
   * Get drivers by IDs (batch operation)
   */
  async getDriversByIds(req, res) {
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

      const drivers = await UserServiceDriver.find({ _id: { $in: ids } });
      const filteredDrivers = populateBasicInfoBatch(drivers, userRole, 'driver');

      res.json({
        success: true,
        data: filteredDrivers
      });
    } catch (error) {
      console.error('Get drivers by IDs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve drivers'
      });
    }
  }

  /**
   * Update driver rating
   */
  async updateDriverRating(req, res) {
    try {
      const { id } = req.params;
      const { rating } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Invalid rating',
          message: 'Rating must be between 1 and 5'
        });
      }

      const driver = await UserServiceDriver.findById(id);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found',
          message: 'No driver found with the provided ID'
        });
      }

      // Calculate new average rating
      const newRatingCount = driver.ratingCount + 1;
      const newRating = ((driver.rating * driver.ratingCount) + rating) / newRatingCount;

      await UserServiceDriver.findByIdAndUpdate(id, {
        rating: Math.round(newRating * 10) / 10, // Round to 1 decimal place
        ratingCount: newRatingCount
      });

      res.json({
        success: true,
        message: 'Driver rating updated successfully',
        data: {
          driverId: id,
          newRating: Math.round(newRating * 10) / 10,
          ratingCount: newRatingCount
        }
      });
    } catch (error) {
      console.error('Update driver rating error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update driver rating'
      });
    }
  }

  /**
   * Get driver statistics
   */
  async getDriverStats(req, res) {
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

      const totalDrivers = await UserServiceDriver.countDocuments();
      const availableDrivers = await UserServiceDriver.countDocuments({ available: true });
      const recentDrivers = await UserServiceDriver.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      // Get average rating
      const avgRatingResult = await UserServiceDriver.aggregate([
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]);
      const avgRating = avgRatingResult.length > 0 ? avgRatingResult[0].avgRating : 0;

      res.json({
        success: true,
        data: {
          totalDrivers,
          availableDrivers,
          recentDrivers,
          averageRating: Math.round(avgRating * 10) / 10,
          period: '30 days'
        }
      });
    } catch (error) {
      console.error('Get driver stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve driver statistics'
      });
    }
  }
}

module.exports = new DriverController();