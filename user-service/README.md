# User Service Integration

This directory contains the integrated user service for the ride booking application. The user service provides comprehensive user management functionality including passengers, drivers, staff, and admin users.

## Features

- **User Management**: Complete CRUD operations for passengers, drivers, staff, and admins
- **Authentication**: JWT-based authentication with role-based access control
- **Role-Based Access Control (RBAC)**: Fine-grained permissions system
- **Data Filtering**: Role-based data filtering for security
- **External Service Integration**: Designed for microservice architecture
- **Batch Operations**: Efficient batch operations for multiple users
- **Real-time Updates**: Support for real-time user data updates

## Architecture

The user service is integrated into the main booking service but can also run as a standalone microservice. It provides:

1. **Integrated Mode**: Runs within the main application at `/user-service/*` endpoints
2. **Standalone Mode**: Can run independently on its own port (default: 3001)

## API Endpoints

### Passenger Endpoints
- `POST /api/passenger` - Create passenger
- `POST /api/passenger/auth` - Authenticate passenger
- `GET /api/passenger/:id` - Get passenger by ID
- `GET /api/passenger/external/:externalId` - Get passenger by external ID
- `GET /api/passenger` - List passengers (staff/admin only)
- `PUT /api/passenger/:id` - Update passenger
- `DELETE /api/passenger/:id` - Delete passenger (staff/admin only)
- `POST /api/passengers/batch` - Get passengers by IDs (batch operation)

### Driver Endpoints
- `POST /api/driver` - Create driver
- `POST /api/driver/auth` - Authenticate driver
- `GET /api/driver/:id` - Get driver by ID
- `GET /api/driver/external/:externalId` - Get driver by external ID
- `GET /api/driver` - List drivers (staff/admin only)
- `GET /api/driver/available` - Get available drivers
- `PUT /api/driver/:id` - Update driver
- `PUT /api/driver/:id/rating` - Update driver rating
- `DELETE /api/driver/:id` - Delete driver (staff/admin only)
- `POST /api/drivers/batch` - Get drivers by IDs (batch operation)

### Admin Endpoints
- `POST /api/admin` - Create admin (admin only)
- `POST /api/admin/auth` - Authenticate admin
- `GET /api/admin/:id` - Get admin by ID (admin only)

### Health & Info Endpoints
- `GET /api/health` - Service health check
- `GET /api/info` - Service information

## Authentication

The service supports multiple authentication methods:

1. **JWT Tokens**: Standard Bearer token authentication
2. **Service-to-Service**: For microservice communication using service tokens

### Service-to-Service Authentication

For external service integration, use these headers:
```
X-Service-Token: <service-token>
X-Service-Name: <service-name>
```

Valid service names: `booking-service`, `ride-service`, `payment-service`

## Role-Based Access Control

The service implements a comprehensive RBAC system:

### Roles
- **passenger**: Can access own data and basic driver info
- **driver**: Can access own data and basic passenger info
- **staff**: Can access passenger, driver, and staff data
- **admin**: Can access all user data
- **service**: Can access filtered data based on service type

### Permissions
- **passenger:read/update/delete**: Passenger data operations
- **driver:read/update/delete**: Driver data operations
- **staff:read/update/delete**: Staff data operations
- **admin:read/update/delete**: Admin data operations
- **user:read**: General user data access

## Data Models

### Passenger
```javascript
{
  id: String,
  externalId: String,
  name: String,
  phone: String,
  email: String,
  emergencyContacts: Array,
  createdAt: Date,
  updatedAt: Date
}
```

### Driver
```javascript
{
  id: String,
  externalId: String,
  name: String,
  phone: String,
  email: String,
  vehicleType: String, // 'mini', 'sedan', 'van'
  available: Boolean,
  carPlate: String,
  carModel: String,
  carColor: String,
  rating: Number,
  lastKnownLocation: {
    latitude: Number,
    longitude: Number,
    bearing: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Integration with Booking Service

The user service is seamlessly integrated with the booking service:

1. **Enhanced userServiceClient**: Automatically tries integrated service first, falls back to external
2. **Unified Authentication**: Uses the same JWT tokens across services
3. **Data Consistency**: Ensures user data consistency across all services
4. **Performance**: Optimized batch operations for booking service needs

## Environment Variables

```bash
# Database Configuration
USER_SERVICE_DB_NAME=rideshare_db
USER_SERVICE_DB_USER=root
USER_SERVICE_DB_PASS=password
USER_SERVICE_DB_HOST=127.0.0.1
USER_SERVICE_DB_PORT=3306
USER_SERVICE_DB_DIALECT=mysql

# Service Configuration
USER_SERVICE_PORT=3001
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
SALT_ROUNDS=10

# Service-to-Service Authentication
SERVICE_TOKENS=token1,token2,token3
```

## Running the Service

### Integrated Mode (Default)
The user service runs as part of the main application:
```bash
npm start
```

### Standalone Mode
To run the user service independently:
```bash
cd user-service
npm install
npm start
```

## Development

### Adding New Features
1. Add new endpoints to the appropriate route file
2. Implement controller methods
3. Add middleware for authentication/authorization
4. Update the userServiceClient for integration

### Testing
```bash
# Test integrated endpoints
curl http://localhost:4000/v1/user-service/api/health

# Test standalone service
curl http://localhost:3001/api/health
```

## Security Considerations

1. **Data Filtering**: All responses are filtered based on user role
2. **Input Validation**: All inputs are validated and sanitized
3. **Rate Limiting**: Built-in rate limiting to prevent abuse
4. **Authentication**: JWT tokens with configurable expiration
5. **Service Tokens**: Secure service-to-service communication

## Monitoring

The service provides health check endpoints for monitoring:
- `/api/health` - Basic health status
- `/api/info` - Detailed service information

## Future Enhancements

- [ ] User profile pictures
- [ ] Advanced search and filtering
- [ ] User activity logging
- [ ] Push notifications
- [ ] Social login integration
- [ ] Multi-language support