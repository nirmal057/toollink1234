import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true
        // Not required here since it's auto-generated in pre-save hook
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerEmail: {
        type: String,
        required: true,
        index: true // Add index for faster email-based queries
    },
    items: [{
        inventory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Inventory',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        notes: String
    }],
    status: {
        type: String,
        enum: ['pending', 'Pending Approval', 'Confirmed', 'Rejected', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid', 'refunded', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'bank_transfer', 'cheque', 'credit'],
        default: 'cash'
    },
    shippingAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, default: 'Sri Lanka' },
        phone: String,
        instructions: String
    },
    billingAddress: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: { type: String, default: 'Sri Lanka' },
        phone: String
    },
    delivery: {
        method: {
            type: String,
            enum: ['pickup', 'delivery', 'courier'],
            default: 'delivery'
        },
        estimatedDate: Date,
        actualDate: Date,
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        trackingNumber: String,
        notes: String
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectedAt: Date,
    rejectionReason: String,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: String,
    internalNotes: String,
    attachments: [{
        filename: String,
        originalName: String,
        url: String,
        size: Number,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    statusHistory: [{
        status: String,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for order age in days
orderSchema.virtual('ageInDays').get(function () {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for total items count
orderSchema.virtual('totalItems').get(function () {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for order status display
orderSchema.virtual('statusDisplay').get(function () {
    return this.status.replace('_', ' ').toUpperCase();
});

// Index for performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'delivery.estimatedDate': 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        // Count orders for today
        const todayStart = new Date(year, today.getMonth(), today.getDate());
        const todayEnd = new Date(year, today.getMonth(), today.getDate() + 1);

        const todayOrderCount = await this.constructor.countDocuments({
            createdAt: { $gte: todayStart, $lt: todayEnd }
        });

        const orderSequence = String(todayOrderCount + 1).padStart(4, '0');
        this.orderNumber = `ORD-${year}${month}${day}-${orderSequence}`;
    }

    // Calculate final amount
    this.finalAmount = this.totalAmount - this.discount + this.tax;

    // Add status history entry
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            updatedBy: this.updatedBy,
            notes: this.notes
        });
    }

    next();
});

// Static method to get order statistics
orderSchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                processingOrders: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
                shippedOrders: { $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] } },
                deliveredOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
            }
        }
    ]);

    const result = stats[0] || {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0
    };

    return result;
};

// Static method to get orders by customer
orderSchema.statics.getOrdersByCustomer = async function (customerId, options = {}) {
    const { page = 1, limit = 10, status } = options;

    const filter = {
        customer: customerId
    };

    if (status) {
        filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
        this.find(filter)
            .populate('customer', 'fullName email phone')
            .populate('items.inventory', 'name sku unit')
            .populate('delivery.driver', 'fullName phone')
            .populate('approvedBy', 'fullName')
            .populate('processedBy', 'fullName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        this.countDocuments(filter)
    ]);

    return {
        orders,
        total,
        page,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
    };
};

// Static method to search orders
orderSchema.statics.searchOrders = async function (query, options = {}) {
    const {
        status,
        customer,
        customerEmail, // Add customerEmail option
        warehouseIds, // Add warehouse filtering option
        startDate,
        endDate,
        page = 1,
        limit = 10,
        sort = '-createdAt'
    } = options;

    const filter = {};

    if (query) {
        filter.$or = [
            { orderNumber: { $regex: query, $options: 'i' } },
            { notes: { $regex: query, $options: 'i' } },
            { 'delivery.trackingNumber': { $regex: query, $options: 'i' } }
        ];
    }

    if (status) {
        if (Array.isArray(status)) {
            filter.status = { $in: status };
        } else if (typeof status === 'string' && status.includes(',')) {
            filter.status = { $in: status.split(',').map(s => s.trim()) };
        } else {
            filter.status = status;
        }
    }

    if (customer) {
        filter.customer = customer;
    }

    if (customerEmail) {
        filter.customerEmail = customerEmail; // Filter by customer email
    }

    if (startDate && endDate) {
        filter.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
        this.find(filter)
            .populate('customer', 'fullName email phone')
            .populate('items.inventory', 'name sku unit')
            .populate('delivery.driver', 'fullName phone')
            .populate('approvedBy', 'fullName')
            .populate('processedBy', 'fullName')
            .sort(sort)
            .skip(skip)
            .limit(limit),
        this.countDocuments(filter)
    ]);

    return {
        orders,
        total,
        page,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
    };
};

const Order = mongoose.model('Order', orderSchema);

export default Order;
