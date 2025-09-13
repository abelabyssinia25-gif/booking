let ioRef;

function attachSocketHandlers(io) {
  ioRef = io;
  io.on('connection', (socket) => {
    // Passenger creates a booking request
    socket.on('booking_request', async (payload) => {
      try {
        const { Booking } = require('../models/bookingModels');
        const { Pricing } = require('../models/pricing');
        const geolib = require('geolib');
        const { authenticateSocket } = require('./socketAuth');

        const user = await authenticateSocket(socket);
        if (!user || user.type !== 'passenger') {
          return socket.emit('booking_error', { message: 'Unauthorized: passenger token required' });
        }

        const pickup = payload?.pickup || payload?.from || {};
        const dropoff = payload?.dropoff || payload?.to || {};
        if (pickup.latitude == null || pickup.longitude == null || dropoff.latitude == null || dropoff.longitude == null) {
          return socket.emit('booking_error', { message: 'pickup and dropoff with valid coordinates are required' });
        }

        // Estimate pricing immediately
        const distanceKm = geolib.getDistance(
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: dropoff.latitude, longitude: dropoff.longitude }
        ) / 1000;
        const pricing = await Pricing.findOne({ vehicleType: payload?.vehicleType || 'mini', isActive: true }).sort({ updatedAt: -1 });
        const p = pricing || { baseFare: 2, perKm: 1, perMinute: 0, waitingPerMinute: 0, surgeMultiplier: 1 };
        const fareBreakdown = {
          base: p.baseFare,
          distanceCost: distanceKm * p.perKm,
          timeCost: 0,
          waitingCost: 0,
          surgeMultiplier: p.surgeMultiplier
        };
        const fareEstimated = (fareBreakdown.base + fareBreakdown.distanceCost + fareBreakdown.timeCost + fareBreakdown.waitingCost) * fareBreakdown.surgeMultiplier;

        const booking = await Booking.create({
          passengerId: String(user.id),
          passengerName: user.name,
          passengerPhone: user.phone,
          vehicleType: payload?.vehicleType || 'mini',
          pickup: { latitude: pickup.latitude, longitude: pickup.longitude },
          dropoff: { latitude: dropoff.latitude, longitude: dropoff.longitude },
          distanceKm,
          fareEstimated,
          fareBreakdown,
          status: 'requested'
        });

        const bookingPayload = {
          id: String(booking._id),
          passengerId: booking.passengerId,
          passenger: { id: String(user.id), name: user.name, phone: user.phone, email: user.email },
          vehicleType: booking.vehicleType,
          pickup: booking.pickup,
          dropoff: booking.dropoff,
          distanceKm,
          fareEstimated,
          fareBreakdown,
          status: booking.status,
          createdAt: booking.createdAt
        };

        // Broadcast for drivers to listen
        io.emit('booking:new', bookingPayload);
        socket.emit('booking_created', bookingPayload);
      } catch (e) {
        socket.emit('booking_error', { message: e.message });
      }
    });

    socket.on('driver:position', (payload) => {
      io.emit('driver:position', payload);
    });
    socket.on('pricing:update', (payload) => {
      io.emit('pricing:update', payload);
    });
  });
}

function broadcast(event, data) {
  if (ioRef) ioRef.emit(event, data);
}

module.exports = { attachSocketHandlers, broadcast };

