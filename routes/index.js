const express = require('express');
const router = express.Router();

// Import user service routes
const userServiceRoutes = require('../user-service/routes');

router.use('/', require('./v1'));
router.use('/user-service', userServiceRoutes);

module.exports = router;
