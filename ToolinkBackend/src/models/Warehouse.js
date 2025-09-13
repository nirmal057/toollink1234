import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    location: {
        address: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        zipCode: {
            type: String,
            required: true,
            trim: true
        },
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    operatingHours: {
        open: {
            type: String,
            default: '08:00'
        },
        close: {
            type: String,
            default: '18:00'
        }
    },
    minStockThresholds: {
        type: Map,
        of: Number,
        default: new Map()
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for location-based queries
warehouseSchema.index({ 'location.coordinates': '2dsphere' });

// Instance method to get minimum threshold for a material
warehouseSchema.methods.getMinThreshold = function (materialId) {
    return this.minStockThresholds.get(materialId.toString()) || 10;
};

// Instance method to set minimum threshold for a material
warehouseSchema.methods.setMinThreshold = function (materialId, threshold) {
    this.minStockThresholds.set(materialId.toString(), threshold);
    return this.save();
};

const Warehouse = mongoose.model('Warehouse', warehouseSchema);

export default Warehouse;
