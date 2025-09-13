Express Mongo Cab API

Quick start

1. Copy env

```
cp .env.example .env
```

2. Start server

```
npm start
```

If local Mongo is not available, the app falls back to in-memory Mongo.

API Highlights
- Auth: `/api/v1/auth/*`
- Bookings CRUD, lifecycle, estimate: `/api/v1/bookings/*`
- Drivers CRUD, availability, nearby: `/api/v1/drivers/*`
- Assignments CRUD: `/api/v1/assignments/*`
- Trips CRUD: `/api/v1/trips/*`
- Live positions: `/api/v1/live/*`
- Pricing CRUD and real-time updates: `/api/v1/pricing/*`

Socket.io broadcasts:
- `driver:position`, `pricing:update`, `booking:update`, `booking:assigned`

