import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const mainOrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true,
        validate: {
            validator: function (value) {
                // Validate format: ORD-YYYY-NNNNNN
                return /^ORD-\d{4}-\d{9}$/.test(value);
            },
            message: 'Order number must follow format: ORD-YYYY-NNNNNNNNN'
        }
    },
    // Enhanced tracking fields
    orderType: {
        type: String,
        enum: ['single-warehouse', 'multi-warehouse'],
        default: 'single-warehouse'
    },
    warehouseBreakdown: [{
        warehouseCode: {
            type: String,
            enum: ['W1', 'W2', 'W3', 'WM']
        },
        subOrderId: String,
        itemCount: Number
    }],
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        materialId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Material',
            required: true
        },
        requestedQty: {
            type: Number,
            required: true,
            min: 1
        },
        preferredWarehouseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Warehouse'
        },

    }],
    deliveryAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        coordinates: {
            lat: Number,
            lng: Number
        },
        contactPerson: String,
        phone: String,
        instructions: String
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    scheduledTime: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending_approval', 'approved', 'created', 'scheduled', 'split_scheduled', 'partially-dispatched', 'completed', 'cancelled', 'rejected'],
        default: 'pending_approval'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: 500
    },

    subOrderIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubOrder'
    }],
    requestedDeliveryDate: {
        type: Date
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Generate order number
mainOrderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await this.constructor.countDocuments({
            createdAt: {
                $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
            }
        });
        this.orderNumber = `MO${dateStr}${String(count + 1).padStart(3, '0')}`;
    }
    next();
});

// Remove the total amount calculation as pricing is not needed

// Add pagination plugin
mainOrderSchema.plugin(mongoosePaginate);

// Indexes for efficient querying
mainOrderSchema.index({ customerId: 1, createdAt: -1 });
mainOrderSchema.index({ status: 1, scheduledDate: 1 });
mainOrderSchema.index({ orderNumber: 1 });

const MainOrder = mongoose.model('MainOrder', mainOrderSchema);

export default MainOrder;
