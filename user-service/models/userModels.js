const mongoose = require('mongoose');

const UserServiceRoleSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true } }, { timestamps: true });
const UserServicePermissionSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true } }, { timestamps: true });

const UserServicePassengerSchema = new mongoose.Schema({
  externalId: { type: String, index: true },
  name: { type: String, required: true },
  phone: { type: String, index: true, unique: true },
  email: { type: String, index: true, unique: true },
  password: { type: String, required: true },
  emergencyContacts: [{ name: String, phone: String }],
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserServiceRole' }]
}, { timestamps: true, toJSON: { versionKey: false }, toObject: { versionKey: false } });

UserServicePassengerSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.password;
    return ret;
  }
});

const UserServiceDriverSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  externalId: { type: String, index: true },
  name: { type: String },
  phone: { type: String },
  email: { type: String },
  password: { type: String },
  vehicleType: { type: String, enum: ['mini', 'sedan', 'van'], default: 'mini' },
  available: { type: Boolean, default: false },
  lastKnownLocation: { 
    latitude: Number, 
    longitude: Number,
    bearing: { type: Number, min: 0, max: 360 } // Bearing in degrees (0-360)
  },
  // Vehicle information
  carPlate: { type: String },
  carModel: { type: String },
  carColor: { type: String },
  // Rating information
  rating: { type: Number, default: 5.0, min: 1, max: 5 },
  ratingCount: { type: Number, default: 0 },
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserServiceRole' }]
}, { timestamps: true, _id: false, toJSON: { versionKey: false }, toObject: { versionKey: false } });

UserServiceDriverSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    // Normalize id field to id
    ret.id = String(ret._id);
    delete ret._id;
    // Remove sensitive/internal fields
    delete ret.password;
    delete ret.ratingCount;
    return ret;
  }
});

// Ensure unique only when phone/email are present
UserServiceDriverSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $type: 'string' } } }
);
UserServiceDriverSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true, $type: 'string' } } }
);

const UserServiceStaffSchema = new mongoose.Schema({
  externalId: { type: String, index: true },
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserServiceRole' }]
}, { timestamps: true, toJSON: { versionKey: false }, toObject: { versionKey: false } });

UserServiceStaffSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.password;
    return ret;
  }
});

const UserServiceAdminSchema = new mongoose.Schema({
  externalId: { type: String, index: true },
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserServiceRole' }]
}, { timestamps: true, toJSON: { versionKey: false }, toObject: { versionKey: false } });

UserServiceAdminSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.password;
    return ret;
  }
});

module.exports = {
  UserServiceRole: mongoose.model('UserServiceRole', UserServiceRoleSchema),
  UserServicePermission: mongoose.model('UserServicePermission', UserServicePermissionSchema),
  UserServicePassenger: mongoose.model('UserServicePassenger', UserServicePassengerSchema),
  UserServiceDriver: mongoose.model('UserServiceDriver', UserServiceDriverSchema),
  UserServiceStaff: mongoose.model('UserServiceStaff', UserServiceStaffSchema),
  UserServiceAdmin: mongoose.model('UserServiceAdmin', UserServiceAdminSchema)
};