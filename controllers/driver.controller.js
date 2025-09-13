const { Driver } = require('../models/userModels');
const { crudController } = require('./basic.crud');
const { Pricing } = require('../models/pricing');
const geolib = require('geolib');

const base = {
  ...crudController(Driver),
  list: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, available } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      let query = {};
      if (status) {
        query.status = status;
      }
      if (available !== undefined) {
        query.available = available === 'true';
      }
      
      const drivers = await Driver.find(query)
        .select('_id name phone email vehicleType available lastKnownLocation rating createdAt updatedAt')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean();
      
      const total = await Driver.countDocuments(query);
      
      const response = drivers.map(d => ({
        id: String(d._id),
        name: d.name,
        phone: d.phone,
        email: d.email,
        vehicleType: d.vehicleType,
        available: !!d.available,
        lastKnownLocation: d.lastKnownLocation || null,
        rating: d.rating || 5.0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }));
      
      return res.json({
        drivers: response,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (e) {
      return res.status(500).json({ message: `Failed to retrieve Driver list: ${e.message}` });
    }
  },
  get: async (req, res) => {
    try {
      const driver = await Driver.findById(req.params.id)
        .select('_id name phone email vehicleType available lastKnownLocation rating externalId createdAt updatedAt')
        .lean();
      
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      // Enrich from external service when needed using externalId
      let name = driver.name;
      let phone = driver.phone;
      let email = driver.email;
      const lookupExternalId = driver.externalId ? String(driver.externalId) : null;
      if ((!name || !phone) && lookupExternalId) {
        try {
          const { getDriverById } = require('../integrations/userServiceClient');
          const ext = await getDriverById(lookupExternalId, { headers: req.headers.authorization ? { Authorization: req.headers.authorization } : undefined });
          if (ext) {
            name = name || ext.name;
            phone = phone || ext.phone;
            email = email || ext.email;
          }
        } catch (_) {}
      }

      const response = {
        id: String(driver._id),
        name: name,
        phone: phone,
        email: email,
        vehicleType: driver.vehicleType,
        available: !!driver.available,
        lastKnownLocation: driver.lastKnownLocation || null,
        rating: driver.rating || 5.0,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt
      };
      
      return res.json(response);
    } catch (e) {
      return res.status(500).json({ message: `Failed to retrieve Driver: ${e.message}` });
    }
  }
};

async function setAvailability(req, res) {
  try {
    const driverId = String((((req.user && req.user.id) !== undefined && (req.user && req.user.id) !== null) ? req.user.id : req.params.id) || '');
    if (!driverId) return res.status(400).json({ message: 'Invalid driver id' });
    const d = await Driver.findByIdAndUpdate(driverId, { $set: { available: !!req.body.available } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    if (!d) return res.status(404).json({ message: 'Not found' });
    
    // Add driver basic information from JWT token
    const driverInfo = {
      id: String(req.user.id),
      name: req.user.name || req.user.fullName || req.user.displayName,
      phone: req.user.phone || req.user.phoneNumber || req.user.mobile,
      email: req.user.email,
      vehicleType: req.user.vehicleType
    };
    
    const response = {
      id: String(d._id),
      driverId: String(d._id),
      available: d.available,
      vehicleType: d.vehicleType,
      lastKnownLocation: d.lastKnownLocation,
      rating: d.rating || 5.0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      driver: driverInfo
    };
    
    return res.json(response);
  } catch (e) { return res.status(500).json({ message: e.message }); }
}

async function updateLocation(req, res) {
  try {
    const driverId = String((((req.user && req.user.id) !== undefined && (req.user && req.user.id) !== null) ? req.user.id : req.params.id) || '');
    if (!driverId) return res.status(400).json({ message: 'Invalid driver id' });
    const { latitude, longitude, bearing } = req.body;
    
    const locationUpdate = { latitude, longitude };
    if (bearing !== undefined && bearing >= 0 && bearing <= 360) {
      locationUpdate.bearing = bearing;
    }
    
    const d = await Driver.findByIdAndUpdate(driverId, { $set: { lastKnownLocation: locationUpdate } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    if (!d) return res.status(404).json({ message: 'Not found' });
    
    // Add driver basic information from JWT token
    const driverInfo = {
      id: String(req.user.id),
      name: req.user.name || req.user.fullName || req.user.displayName,
      phone: req.user.phone || req.user.phoneNumber || req.user.mobile,
      email: req.user.email,
      vehicleType: req.user.vehicleType
    };
    
    const response = {
      id: String(d._id),
      driverId: String(d._id),
      available: d.available,
      vehicleType: d.vehicleType,
      lastKnownLocation: d.lastKnownLocation,
      rating: d.rating || 5.0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      driver: driverInfo
    };
    
    return res.json(response);
  } catch (e) { return res.status(500).json({ message: e.message }); }
}

async function availableNearby(req, res) {
  try {
    const { latitude, longitude, radiusKm = 5, vehicleType } = req.query;
    const all = await Driver.find({ available: true, ...(vehicleType ? { vehicleType } : {}) });
    const nearby = all.filter(d => d.lastKnownLocation && distanceKm(d.lastKnownLocation, { latitude: +latitude, longitude: +longitude }) <= +radiusKm);

    // Enrich driver info via templated external user directory to target the correct API
    const { getDriverById, getDriversByIds, listDrivers } = require('../integrations/userServiceClient');
    const authHeader = req.headers && req.headers.authorization ? { Authorization: req.headers.authorization } : undefined;

    // Pre-fetch external details for drivers with externalId
    const externalIds = nearby.map(d => d.externalId).filter(Boolean).map(String);
    let externalDetailsMap = {};
    if (externalIds.length) {
      try {
        const details = await getDriversByIds(externalIds, authHeader?.Authorization);
        externalDetailsMap = Object.fromEntries(details.map(d => [String(d.id), d]));
      } catch (_) {}
    }

    const enriched = await Promise.all(nearby.map(async (driver) => {
      const base = {
        id: String(driver._id),
        driverId: String(driver._id),
        vehicleType: driver.vehicleType,
        rating: driver.rating || 5.0,
        lastKnownLocation: {
          latitude: driver.lastKnownLocation.latitude,
          longitude: driver.lastKnownLocation.longitude,
          bearing: driver.lastKnownLocation.bearing || null
        },
        distanceKm: distanceKm(driver.lastKnownLocation, { latitude: +latitude, longitude: +longitude })
      };

      const lookupExternalId = driver.externalId ? String(driver.externalId) : null;
      let name = driver.name || undefined;
      let phone = driver.phone || undefined;
      let email = driver.email || undefined;

      // 1) Use pre-fetched external details by externalId when available
      if (lookupExternalId && externalDetailsMap[lookupExternalId]) {
        const ext = externalDetailsMap[lookupExternalId];
        name = name || ext.name;
        phone = phone || ext.phone;
        email = email || ext.email;
      }

      // 2) Fallback: fetch individual external record
      if ((!name || !phone) && lookupExternalId) {
        try {
          const ext = await getDriverById(lookupExternalId, { headers: authHeader });
          if (ext) {
            name = name || ext.name;
            phone = phone || ext.phone;
            email = email || ext.email;
            // persist enrichment for future requests
            try {
              const update = { };
              if (ext.name && !driver.name) update.name = ext.name;
              if (ext.phone && !driver.phone) update.phone = ext.phone;
              if (driver.externalId == null && lookupExternalId) update.externalId = String(lookupExternalId);
              if (Object.keys(update).length) await Driver.findByIdAndUpdate(driver._id, { $set: update });
            } catch (_) {}
          }
          // If still missing, try listing by vehicleType and match by externalId
          if ((!name || !phone) && lookupExternalId) {
            const list = await listDrivers({ vehicleType: driver.vehicleType }, { headers: authHeader });
            const match = (list || []).find(u => String(u.id) === lookupExternalId);
            if (match) {
              name = name || match.name;
              phone = phone || match.phone;
              email = email || match.email;
              // persist
              try {
                const update = { };
                if (match.name && !driver.name) update.name = match.name;
                if (match.phone && !driver.phone) update.phone = match.phone;
                if (Object.keys(update).length) await Driver.findByIdAndUpdate(driver._id, { $set: update });
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      const driverInfo = {
        id: String(driver._id),
        name: name || '',
        phone: phone || '',
        email: email || '',
        vehicleType: driver.vehicleType
      };

      return { ...base, driver: driverInfo };
    }));

    // Sort by distance (closest first)
    enriched.sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json(enriched);
  } catch (e) { return res.status(500).json({ message: `Failed to find nearby drivers: ${e.message}` }); }
}

function distanceKm(a, b) {
  if (!a || !b || a.latitude == null || b.latitude == null) return Number.POSITIVE_INFINITY;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const aHarv = Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(aHarv));
}

// Fare estimation for passengers before booking
async function estimateFareForPassenger(req, res) {
  try {
    const { vehicleType = 'mini', pickup, dropoff } = req.body;
    
    if (!pickup || !dropoff) {
      return res.status(400).json({ message: 'Pickup and dropoff locations are required' });
    }

    if (!pickup.latitude || !pickup.longitude || !dropoff.latitude || !dropoff.longitude) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required for both pickup and dropoff' });
    }

    // Calculate distance
    const distanceKm = geolib.getDistance(
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: dropoff.latitude, longitude: dropoff.longitude }
    ) / 1000;

    // Get pricing for vehicle type
    const pricing = await Pricing.findOne({ vehicleType, isActive: true }).sort({ updatedAt: -1 });
    
    if (!pricing) {
      return res.status(404).json({ message: `No pricing found for vehicle type: ${vehicleType}` });
    }

    // Calculate fare breakdown
    const fareBreakdown = {
      base: pricing.baseFare,
      distanceCost: distanceKm * pricing.perKm,
      timeCost: 0, // Could be calculated based on estimated travel time
      waitingCost: 0, // Could be calculated based on waiting time
      surgeMultiplier: pricing.surgeMultiplier
    };

    const estimatedFare = (fareBreakdown.base + fareBreakdown.distanceCost + fareBreakdown.timeCost + fareBreakdown.waitingCost) * fareBreakdown.surgeMultiplier;

    res.json({
      vehicleType,
      distanceKm: Math.round(distanceKm * 100) / 100, // Round to 2 decimal places
      estimatedFare: Math.round(estimatedFare * 100) / 100,
      fareBreakdown,
      pricing: {
        baseFare: pricing.baseFare,
        perKm: pricing.perKm,
        perMinute: pricing.perMinute,
        waitingPerMinute: pricing.waitingPerMinute,
        surgeMultiplier: pricing.surgeMultiplier
      }
    });
  } catch (e) {
    res.status(500).json({ message: `Failed to estimate fare: ${e.message}` });
  }
}

// Fare estimation for drivers before accepting booking
async function estimateFareForDriver(req, res) {
  try {
    const { bookingId } = req.params;
    const driverId = req.user.id;

    // Get the booking details
    const { Booking } = require('../models/bookingModels');
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if driver is assigned to this booking
    if (booking.driverId && booking.driverId !== driverId) {
      return res.status(403).json({ message: 'You are not assigned to this booking' });
    }

    // Calculate distance if not already calculated
    let distanceKm = booking.distanceKm;
    if (!distanceKm && booking.pickup && booking.dropoff) {
      distanceKm = geolib.getDistance(
        { latitude: booking.pickup.latitude, longitude: booking.pickup.longitude },
        { latitude: booking.dropoff.latitude, longitude: booking.dropoff.longitude }
      ) / 1000;
    }

    // Get pricing for vehicle type
    const pricing = await Pricing.findOne({ vehicleType: booking.vehicleType, isActive: true }).sort({ updatedAt: -1 });
    
    if (!pricing) {
      return res.status(404).json({ message: `No pricing found for vehicle type: ${booking.vehicleType}` });
    }

    // Calculate fare breakdown
    const fareBreakdown = {
      base: pricing.baseFare,
      distanceCost: distanceKm * pricing.perKm,
      timeCost: 0,
      waitingCost: 0,
      surgeMultiplier: pricing.surgeMultiplier
    };

    const estimatedFare = (fareBreakdown.base + fareBreakdown.distanceCost + fareBreakdown.timeCost + fareBreakdown.waitingCost) * fareBreakdown.surgeMultiplier;

    // Calculate driver earnings (after commission)
    const { Commission } = require('../models/commission');
    const commission = await Commission.findOne({ isActive: true }).sort({ createdAt: -1 });
    const commissionRate = commission ? commission.percentage : 15; // Default 15%
    
    const grossFare = estimatedFare;
    const commissionAmount = (grossFare * commissionRate) / 100;
    const netEarnings = grossFare - commissionAmount;

    res.json({
      bookingId: booking._id,
      vehicleType: booking.vehicleType,
      distanceKm: Math.round(distanceKm * 100) / 100,
      estimatedFare: Math.round(estimatedFare * 100) / 100,
      fareBreakdown,
      driverEarnings: {
        grossFare: Math.round(grossFare * 100) / 100,
        commissionRate: commissionRate,
        commissionAmount: Math.round(commissionAmount * 100) / 100,
        netEarnings: Math.round(netEarnings * 100) / 100
      },
      pickup: booking.pickup,
      dropoff: booking.dropoff
    });
  } catch (e) {
    res.status(500).json({ message: `Failed to estimate fare for driver: ${e.message}` });
  }
}

module.exports = { 
  ...base, 
  setAvailability, 
  updateLocation, 
  availableNearby, 
  estimateFareForPassenger, 
  estimateFareForDriver 
};

// Combined driver discovery and fare estimation for passengers
async function discoverAndEstimate(req, res) {
  try {
    const { pickup, dropoff, radiusKm = 5, vehicleType } = req.body || {};

    if (!pickup || !dropoff) {
      return res.status(400).json({ message: 'pickup and dropoff are required' });
    }
    if (
      pickup.latitude == null || pickup.longitude == null ||
      dropoff.latitude == null || dropoff.longitude == null
    ) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required for pickup and dropoff' });
    }

    // Find nearby available drivers (reuse logic with minimal duplication)
    const all = await Driver.find({ available: true, ...(vehicleType ? { vehicleType } : {}) });
    const nearby = all.filter(d => d.lastKnownLocation && distanceKm(d.lastKnownLocation, { latitude: +pickup.latitude, longitude: +pickup.longitude }) <= +radiusKm);

    // Enrich driver data via templated external user directory to target the correct API
    const { getDriverById: getDriverById2, listDrivers: listDrivers2, getDriversByIds: getDriversByIds2 } = require('../integrations/userServiceClient');
    const authHeader2 = req.headers && req.headers.authorization ? { Authorization: req.headers.authorization } : undefined;

    // Try batch first for efficiency using externalId when present
    let idToExternal = {};
    const extIds2 = nearby.map(d => d.externalId).filter(Boolean).map(String);
    if (extIds2.length) {
      try {
        const batch = await getDriversByIds2(extIds2, authHeader2?.Authorization);
        idToExternal = Object.fromEntries((batch || []).map(u => [String(u.id), { name: u.name, phone: u.phone, email: u.email }]));
      } catch (_) {}
    }

    const drivers = await Promise.all(nearby.map(async (driver) => {
      const base = {
        id: String(driver._id),
        driverId: String(driver._id),
        vehicleType: driver.vehicleType,
        rating: driver.rating || 5.0,
        lastKnownLocation: driver.lastKnownLocation || null,
        distanceKm: distanceKm(driver.lastKnownLocation, { latitude: +pickup.latitude, longitude: +pickup.longitude })
      };

      const lookupExternalId2 = driver.externalId ? String(driver.externalId) : null;
      let name = (lookupExternalId2 && idToExternal[lookupExternalId2]?.name) || driver.name || undefined;
      let phone = (lookupExternalId2 && idToExternal[lookupExternalId2]?.phone) || driver.phone || undefined;
      let email = (lookupExternalId2 && idToExternal[lookupExternalId2]?.email) || driver.email || undefined;
      if (!name || !phone) {
        try {
          const ext = lookupExternalId2 ? await getDriverById2(lookupExternalId2, { headers: authHeader2 }) : null;
          if (ext) {
            name = name || ext.name;
            phone = phone || ext.phone;
            email = email || ext.email;
            // persist enrichment
            try {
              const update = { };
              if (ext.name && !driver.name) update.name = ext.name;
              if (ext.phone && !driver.phone) update.phone = ext.phone;
              if (driver.externalId == null && lookupExternalId2) update.externalId = String(lookupExternalId2);
              if (Object.keys(update).length) await Driver.findByIdAndUpdate(driver._id, { $set: update });
            } catch (_) {}
          }
          if ((!name || !phone) && lookupExternalId2) {
            const list = await listDrivers2({ vehicleType: driver.vehicleType }, { headers: authHeader2 });
            const match = (list || []).find(u => String(u.id) === lookupExternalId2);
            if (match) {
              name = name || match.name;
              phone = phone || match.phone;
              email = email || match.email;
              // persist
              try {
                const update = { };
                if (match.name && !driver.name) update.name = match.name;
                if (match.phone && !driver.phone) update.phone = match.phone;
                if (Object.keys(update).length) await Driver.findByIdAndUpdate(driver._id, { $set: update });
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      const driverInfo = {
        id: String(driver._id),
        name: name || '',
        phone: phone || '',
        email: email || '',
        vehicleType: driver.vehicleType
      };

      return { ...base, driver: driverInfo };
    }));
    drivers.sort((a, b) => a.distanceKm - b.distanceKm);

    // Fare estimation
    const pricing = await Pricing.findOne({ vehicleType: vehicleType || 'mini', isActive: true }).sort({ updatedAt: -1 });
    if (!pricing) {
      return res.status(404).json({ message: `No pricing found for vehicle type: ${vehicleType || 'mini'}` });
    }

    const distanceKmVal = geolib.getDistance(
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: dropoff.latitude, longitude: dropoff.longitude }
    ) / 1000;

    const fareBreakdown = {
      base: pricing.baseFare,
      distanceCost: distanceKmVal * pricing.perKm,
      timeCost: 0,
      waitingCost: 0,
      surgeMultiplier: pricing.surgeMultiplier
    };
    const estimatedFare = (fareBreakdown.base + fareBreakdown.distanceCost + fareBreakdown.timeCost + fareBreakdown.waitingCost) * fareBreakdown.surgeMultiplier;

    return res.json({
      drivers,
      estimate: {
        vehicleType: vehicleType || 'mini',
        distanceKm: Math.round(distanceKmVal * 100) / 100,
        estimatedFare: Math.round(estimatedFare * 100) / 100,
        fareBreakdown
      }
    });
  } catch (e) {
    return res.status(500).json({ message: `Failed to discover drivers and estimate fare: ${e.message}` });
  }
}

module.exports.discoverAndEstimate = discoverAndEstimate;

