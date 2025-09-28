import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    licenseNumber: {
        type: String,
        required: true,
        unique: true
    },
    licenseExpiry: {
        type: Date,
        required: true
    },
    vehicleType: {
        type: String,
        enum: ['bike', 'car', 'van', 'truck'],
        required: true
    },
    vehicleNumber: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    currentLocation: {
        latitude: {
            type: Number
        },
        longitude: {
            type: Number
        },
        address: {
            type: String
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    workingHours: {
        start: {
            type: String,
            default: '09:00'
        },
        end: {
            type: String,
            default: '18:00'
        }
    },
    assignedWarehouses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse'
    }],
    deliveryCapacity: {
        type: Number,
        default: 10
    },
    currentDeliveries: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery'
    }],
    totalDeliveries: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 5.0,
        min: 1,
        max: 5
    },
    earnings: {
        today: {
            type: Number,
            default: 0
        },
        thisWeek: {
            type: Number,
            default: 0
        },
        thisMonth: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            default: 0
        }
    },
    documents: {
        license: {
            url: String,
            verified: {
                type: Boolean,
                default: false
            },
            verifiedAt: Date,
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        },
        vehicle: {
            url: String,
            verified: {
                type: Boolean,
                default: false
            },
            verifiedAt: Date,
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        }
    },
    emergencyContact: {
        name: String,
        phone: String,
        relation: String
    },
    bankDetails: {
        accountHolder: String,
        accountNumber: String,
        bankName: String,
        ifscCode: String
    }
}, {
    timestamps: true
});

// Index for faster queries
driverSchema.index({ userId: 1 });
driverSchema.index({ isActive: 1, isAvailable: 1 });
driverSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });
driverSchema.index({ assignedWarehouses: 1 });

// Virtual for current delivery count
driverSchema.virtual('currentDeliveryCount').get(function () {
    return this.currentDeliveries?.length || 0;
});

// Method to update location
driverSchema.methods.updateLocation = function (latitude, longitude, address) {
    this.currentLocation = {
        latitude,
        longitude,
        address,
        lastUpdated: new Date()
    };
    return this.save();
};

// Method to add earnings
driverSchema.methods.addEarnings = function (amount) {
    this.earnings.today += amount;
    this.earnings.thisWeek += amount;
    this.earnings.thisMonth += amount;
    this.earnings.total += amount;
    return this.save();
};

const Driver = mongoose.model('Driver', driverSchema);

export default Driver;
