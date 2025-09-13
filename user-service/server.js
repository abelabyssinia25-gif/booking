/**
 * User Service Server
 * Standalone user service that can be run independently or integrated
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const userServiceRoutes = require('./routes');

const app = express();

// ---------- MIDDLEWARE ----------
app.set('trust proxy', 1);
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// Rate limiter
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
  })
);

// ---------- ROUTES ----------
app.use('/api', userServiceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'user-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// ---------- ERROR HANDLING ----------
app.use((err, req, res, next) => {
  console.error('User service error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

const PORT = process.env.USER_SERVICE_PORT || 3001;

app.listen(PORT, () => {
  console.log(`User Service listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints: http://localhost:${PORT}/api`);
});

module.exports = app;