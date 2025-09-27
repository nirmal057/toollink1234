import mongoose from 'mongoose';

const DeliverySchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerEmail: {
        type: String,
        required: true,
        index: true
    },
    warehouseId: {
        type: String,
        required: true,
        index: true
    },
    warehouseName: {
        type: String,
        required: true
    },
    items: [{
        inventoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Inventory',
            required: true
        },
        itemName: {
            type: String,
            required: true
        },
        category: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        warehouse: {
            type: String,
            required: true
        }
    }],
    deliveryAddress: {
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        zipCode: {
            type: String,
            required: true
        },
        country: {
            type: String,
            default: 'Sri Lanka'
        },
        additionalInfo: String
    },
    deliveryDate: {
        type: Date,
        required: true,
        validate: {
            validator: function (date) {
                // Only allow tomorrow's date or later
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                return date >= tomorrow;
            },
            message: 'Delivery date must be tomorrow or later'
        }
    },
    timeSlot: {
        type: String,
        enum: ['morning', 'afternoon', 'evening'],
        required: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'in_transit', 'delivered', 'failed', 'cancelled'],
        default: 'scheduled'
    },
    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver'
    },
    driverNotes: String,
    customerNotes: String,
    adminNotes: String,
    trackingNumber: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    estimatedDeliveryTime: {
        start: Date,
        end: Date
    },
    actualDeliveryTime: Date,
    deliveryProof: {
        type: String, // URL to delivery proof image
    },
    signature: {
        type: String, // Base64 signature or URL
    },
    contactNumber: {
        type: String,
        required: true
    },
    alternateContact: String,
    specialInstructions: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        notes: String
    }]
}, {
    timestamps: true,
    collection: 'deliveries'
});

// Indexes for better performance
DeliverySchema.index({ orderId: 1 });
DeliverySchema.index({ customerId: 1 });
DeliverySchema.index({ customerEmail: 1 });
DeliverySchema.index({ warehouseId: 1 });
DeliverySchema.index({ deliveryDate: 1 });
DeliverySchema.index({ status: 1 });
DeliverySchema.index({ trackingNumber: 1 });
DeliverySchema.index({ createdAt: -1 });

// Generate tracking number before saving
DeliverySchema.pre('save', async function (next) {
    if (this.isNew && !this.trackingNumber) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        this.trackingNumber = `TL${timestamp}${random}`.toUpperCase();
    }
    next();
});

// Add status change to history
DeliverySchema.methods.updateStatus = function (newStatus, updatedBy, notes = '') {
    this.status = newStatus;
    this.updatedBy = updatedBy;
    this.statusHistory.push({
        status: newStatus,
        updatedBy: updatedBy,
        notes: notes,
        timestamp: new Date()
    });
    return this.save();
};

// Get deliveries for a specific customer
DeliverySchema.statics.getCustomerDeliveries = function (customerEmail, orderId = null) {
    const query = { customerEmail };
    if (orderId) {
        query.orderId = orderId;
    }
    return this.find(query)
        .populate('orderId', 'orderNumber totalAmount')
        .populate('assignedDriver', 'name phone email')
        .sort({ createdAt: -1 });
};

// Get deliveries by warehouse
DeliverySchema.statics.getWarehouseDeliveries = function (warehouseId, date = null) {
    const query = { warehouseId };
    if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.deliveryDate = { $gte: startDate, $lte: endDate };
    }
    return this.find(query)
        .populate('orderId', 'orderNumber totalAmount')
        .populate('customerId', 'name email phone')
        .populate('assignedDriver', 'name phone email')
        .sort({ deliveryDate: 1 });
};

export default mongoose.model('Delivery', DeliverySchema);
