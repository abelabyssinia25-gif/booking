const axios = require('axios');

function buildUrlFromTemplate(template, params) {
  if (!template) return null;
  return Object.keys(params || {}).reduce(
    (acc, key) => acc.replace(new RegExp(`{${key}}`, 'g'), encodeURIComponent(String(params[key]))),
    template
  );
}

function getAuthHeaders(tokenOrHeader) {
  const headers = { 'Accept': 'application/json' };
  if (!tokenOrHeader) return headers;
  if (typeof tokenOrHeader === 'string') {
    headers['Authorization'] = tokenOrHeader.startsWith('Bearer ') ? tokenOrHeader : `Bearer ${tokenOrHeader}`;
  } else if (typeof tokenOrHeader === 'object') {
    if (tokenOrHeader.Authorization) headers['Authorization'] = tokenOrHeader.Authorization;
  }
  return headers;
}

async function httpGet(url, headers) {
  const res = await axios.get(url, { headers });
  return res.data;
}

async function httpPost(url, body, headers) {
  const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json', ...(headers || {}) } });
  return res.data;
}

// Low-level helpers driven by env configuration
function getAuthBase() {
  return (process.env.AUTH_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function getTemplate(name) {
  return process.env[name] || null;
}

// Enhanced API with integrated user service support
async function getPassengerDetails(id, token) {
  try {
    // First try the integrated user service
    const integratedUrl = `${getAuthBase()}/user-service/passenger/${id}`;
    const integratedData = await httpGet(integratedUrl, getAuthHeaders(token));
    
    if (integratedData && integratedData.success && integratedData.data) {
      const u = integratedData.data;
      return { 
        success: true, 
        user: { 
          id: String(u.id || u._id || id), 
          name: u.name, 
          phone: u.phone, 
          email: u.email,
          externalId: u.externalId
        } 
      };
    }
  } catch (e) {
    console.log('Integrated user service failed, trying external service:', e.message);
  }

  // Fallback to external service
  try {
    const tpl = getTemplate('PASSENGER_LOOKUP_URL_TEMPLATE') || `${getAuthBase()}/passengers/{id}`;
    const url = buildUrlFromTemplate(tpl, { id });
    const data = await httpGet(url, getAuthHeaders(token));
    const u = data?.data || data?.user || data?.passenger || data;
    return { success: true, user: { id: String(u.id || u._id || id), name: u.name, phone: u.phone, email: u.email } };
  } catch (e) {
    return { success: false, message: e.response?.data?.message || e.message };
  }
}

async function getDriverDetails(id, token) {
  try {
    // First try the integrated user service
    const integratedUrl = `${getAuthBase()}/user-service/driver/${id}`;
    const integratedData = await httpGet(integratedUrl, getAuthHeaders(token));
    
    if (integratedData && integratedData.success && integratedData.data) {
      const u = integratedData.data;
      return { 
        success: true, 
        user: { 
          id: String(u.id || u._id || id), 
          name: u.name, 
          phone: u.phone, 
          email: u.email,
          externalId: u.externalId,
          vehicleType: u.vehicleType,
          carPlate: u.carPlate,
          carModel: u.carModel,
          carColor: u.carColor,
          rating: u.rating,
          available: u.available,
          lastKnownLocation: u.lastKnownLocation
        } 
      };
    }
  } catch (e) {
    console.log('Integrated user service failed, trying external service:', e.message);
  }

  // Fallback to external service
  try {
    const tpl = getTemplate('DRIVER_LOOKUP_URL_TEMPLATE') || `${getAuthBase()}/drivers/{id}`;
    const url = buildUrlFromTemplate(tpl, { id });
    const data = await httpGet(url, getAuthHeaders(token));
    const u = data?.data || data?.user || data?.driver || data;
    return { success: true, user: { id: String(u.id || u._id || id), name: u.name, phone: u.phone, email: u.email } };
  } catch (e) {
    return { success: false, message: e.response?.data?.message || e.message };
  }
}

async function getDriverById(id, options) {
  const token = options && options.headers ? options.headers.Authorization : undefined;
  const res = await getDriverDetails(id, token);
  if (!res.success) return null;
  return { 
    id: String(res.user.id), 
    name: res.user.name, 
    phone: res.user.phone, 
    email: res.user.email,
    vehicleType: res.user.vehicleType,
    carPlate: res.user.carPlate,
    carModel: res.user.carModel,
    carColor: res.user.carColor,
    rating: res.user.rating,
    available: res.user.available,
    lastKnownLocation: res.user.lastKnownLocation
  };
}

async function getPassengerById(id, options) {
  const token = options && options.headers ? options.headers.Authorization : undefined;
  const res = await getPassengerDetails(id, token);
  if (!res.success) return null;
  return { 
    id: String(res.user.id), 
    name: res.user.name, 
    phone: res.user.phone, 
    email: res.user.email,
    externalId: res.user.externalId
  };
}

async function getDriversByIds(ids = [], token) {
  try {
    // First try the integrated user service batch endpoint
    const integratedUrl = `${getAuthBase()}/user-service/drivers/batch`;
    const integratedData = await httpPost(integratedUrl, { ids }, getAuthHeaders(token));
    
    if (integratedData && integratedData.success && Array.isArray(integratedData.data)) {
      return integratedData.data.map(u => ({ 
        id: String(u.id || u._id || ''), 
        name: u.name, 
        phone: u.phone,
        vehicleType: u.vehicleType,
        carPlate: u.carPlate,
        rating: u.rating,
        available: u.available
      }));
    }
  } catch (e) {
    console.log('Integrated user service batch failed, trying external service:', e.message);
  }

  // Fallback to external service
  try {
    const base = getAuthBase();
    const url = `${base}/drivers/batch`;
    const data = await httpPost(url, { ids }, getAuthHeaders(token));
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return arr.map(u => ({ id: String(u.id || u._id || ''), name: u.name, phone: u.phone }));
  } catch (e) {
    // fallback: fetch one by one
    const results = await Promise.all((ids || []).map(id => getDriverById(id, { headers: getAuthHeaders(token) })));
    return results.filter(Boolean);
  }
}

async function listDrivers(query = {}, options) {
  try {
    // First try the integrated user service
    const integratedUrl = `${getAuthBase()}/user-service/driver`;
    const url = new URL(integratedUrl);
    Object.entries(query || {}).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    
    const integratedData = await httpGet(url.toString(), getAuthHeaders(options && options.headers ? options.headers.Authorization : undefined));
    
    if (integratedData && integratedData.success && Array.isArray(integratedData.data)) {
      return integratedData.data.map(u => ({ 
        id: String(u.id || u._id || ''), 
        name: u.name, 
        phone: u.phone,
        vehicleType: u.vehicleType,
        carPlate: u.carPlate,
        rating: u.rating,
        available: u.available
      }));
    }
  } catch (e) {
    console.log('Integrated user service list failed, trying external service:', e.message);
  }

  // Fallback to external service
  try {
    const base = getAuthBase();
    const url = new URL(`${base}/drivers`);
    Object.entries(query || {}).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    const data = await httpGet(url.toString(), getAuthHeaders(options && options.headers ? options.headers.Authorization : undefined));
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return arr.map(u => ({ id: String(u.id || u._id || ''), name: u.name, phone: u.phone }));
  } catch (_) { return []; }
}

async function listPassengers(query = {}, options) {
  try {
    // First try the integrated user service
    const integratedUrl = `${getAuthBase()}/user-service/passenger`;
    const url = new URL(integratedUrl);
    Object.entries(query || {}).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    
    const integratedData = await httpGet(url.toString(), getAuthHeaders(options && options.headers ? options.headers.Authorization : undefined));
    
    if (integratedData && integratedData.success && Array.isArray(integratedData.data)) {
      return integratedData.data.map(u => ({ 
        id: String(u.id || u._id || ''), 
        name: u.name, 
        phone: u.phone,
        email: u.email
      }));
    }
  } catch (e) {
    console.log('Integrated user service list failed, trying external service:', e.message);
  }

  // Fallback to external service
  try {
    const base = getAuthBase();
    const url = new URL(`${base}/passengers`);
    Object.entries(query || {}).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    const data = await httpGet(url.toString(), getAuthHeaders(options && options.headers ? options.headers.Authorization : undefined));
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return arr.map(u => ({ id: String(u.id || u._id || ''), name: u.name, phone: u.phone }));
  } catch (_) { return []; }
}

async function getStaffById(id) {
  try {
    const base = getAuthBase();
    const url = `${base}/staff/${encodeURIComponent(String(id))}`;
    const data = await httpGet(url, getAuthHeaders());
    const u = data?.data || data || {};
    return { id: String(u.id || u._id || id), name: u.name, phone: u.phone };
  } catch (_) { return null; }
}

async function listStaff(query = {}) {
  try {
    const base = getAuthBase();
    const url = new URL(`${base}/staff`);
    Object.entries(query || {}).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    const data = await httpGet(url.toString(), getAuthHeaders());
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return arr.map(u => ({ id: String(u.id || u._id || ''), name: u.name, phone: u.phone }));
  } catch (_) { return []; }
}

async function getAdminById(id) {
  try {
    const base = getAuthBase();
    const url = `${base}/admins/${encodeURIComponent(String(id))}`;
    const data = await httpGet(url, getAuthHeaders());
    const u = data?.data || data || {};
    return { id: String(u.id || u._id || id), name: u.name, phone: u.phone };
  } catch (_) { return null; }
}

async function listAdmins(query = {}) {
  try {
    const base = getAuthBase();
    const url = new URL(`${base}/admins`);
    Object.entries(query || {}).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    const data = await httpGet(url.toString(), getAuthHeaders());
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return arr.map(u => ({ id: String(u.id || u._id || ''), name: u.name, phone: u.phone }));
  } catch (_) { return []; }
}

module.exports = {
  // high level
  getPassengerDetails,
  getDriverDetails,
  getDriversByIds,
  // compatibility with existing controllers
  getPassengerById,
  getDriverById,
  listDrivers,
  listPassengers,
  getStaffById,
  listStaff,
  getAdminById,
  listAdmins
};

// --- Update Booking ---
exports.update = async (req, res) => {
  try {
    const updated = await Booking.findOneAndUpdate(
      { _id: req.params.id, passengerId: String(req.user?.id) },
      req.body,
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ message: 'Booking not found or you do not have permission to update it' });

    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ message: `Failed to update booking: ${e.message}` });
  }
};

// --- Remove Booking ---
exports.remove = async (req, res) => {
  try {
    const r = await Booking.findOneAndDelete({ _id: req.params.id, passengerId: String(req.user?.id) });
    if (!r)
      return res.status(404).json({ message: 'Booking not found or you do not have permission to delete it' });

    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ message: `Failed to delete booking: ${e.message}` });
  }
};

// --- Booking Lifecycle ---
exports.lifecycle = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (!['requested', 'accepted', 'ongoing', 'completed', 'canceled'].includes(status))
      return res.status(400).json({ message: `Invalid status '${status}'.` });

    if (booking.status === 'completed')
      return res.status(400).json({ message: 'Cannot change status of completed bookings' });

    if (status === 'accepted' && req.user?.type === 'driver') booking.driverId = String(req.user.id);

    booking.status = status;
    if (status === 'completed') booking.fareFinal = booking.fareEstimated;

    await booking.save();
    await TripHistory.create({
      bookingId: booking._id,
      driverId: booking.driverId,
      passengerId: booking.passengerId,
      status: booking.status,
    });

    broadcast('booking:update', { id: booking._id, status });
    return res.json(booking);
  } catch (e) {
    return res.status(500).json({ message: `Failed to update booking lifecycle: ${e.message}` });
  }
};

// --- Assign Driver ---
exports.assign = async (req, res) => {
  try {
    const { driverId, dispatcherId } = req.body;
    const bookingId = req.params.id;
    if (!driverId || !dispatcherId)
      return res.status(400).json({ message: 'Driver and dispatcher IDs required' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'requested')
      return res.status(400).json({ message: `Cannot assign booking with status '${booking.status}'` });

    const assignment = await BookingAssignment.create({
      bookingId,
      driverId: String(driverId),
      dispatcherId: String(dispatcherId),
      passengerId: booking.passengerId,
    });

    booking.driverId = String(driverId);
    booking.status = 'accepted';
    await booking.save();

    broadcast('booking:assigned', { bookingId, driverId });
    return res.json({ booking, assignment });
  } catch (e) {
    return res.status(500).json({ message: `Failed to assign booking: ${e.message}` });
  }
};

// --- Fare Estimation Endpoint ---
exports.estimate = async (req, res) => {
  try {
    const { vehicleType, pickup, dropoff } = req.body;
    if (!pickup || !dropoff)
      return res.status(400).json({ message: 'Pickup and dropoff locations are required for fare estimation' });

    const est = await estimateFare({ vehicleType, pickup, dropoff });
    return res.json(est);
  } catch (e) {
    return res.status(500).json({ message: `Failed to estimate fare: ${e.message}` });
  }
};

// --- Rating Endpoints ---
exports.ratePassenger = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const bookingId = req.params.id;
    const driverId = req.user.id;

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.driverId !== driverId) return res.status(403).json({ message: 'Only the assigned driver can rate the passenger' });
    if (booking.status !== 'completed') return res.status(400).json({ message: 'Can only rate after completion' });

    booking.passengerRating = rating;
    if (comment) booking.passengerComment = comment;
    await booking.save();

    return res.json({ message: 'Passenger rated successfully', booking });
  } catch (e) {
    return res.status(500).json({ message: `Failed to rate passenger: ${e.message}` });
  }
};

exports.rateDriver = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const bookingId = req.params.id;
    const passengerId = req.user.id;

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (String(booking.passengerId) !== String(passengerId)) return res.status(403).json({ message: 'Only the passenger can rate the driver' });
    if (booking.status !== 'completed') return res.status(400).json({ message: 'Can only rate after completion' });

    booking.driverRating = rating;
    if (comment) booking.driverComment = comment;
    await booking.save();

    return res.json({ message: 'Driver rated successfully' });
  } catch (e) {
    return res.status(500).json({ message: `Failed to rate driver: ${e.message}` });
  }
};
