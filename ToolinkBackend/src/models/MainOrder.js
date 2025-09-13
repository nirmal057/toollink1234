import mongoose from 'mongoose';

const mainOrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
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
        unitPrice: {
            type: Number,
            min: 0,
            default: 0
        },
        totalPrice: {
            type: Number,
            min: 0,
            default: 0
        }
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
        enum: ['created', 'scheduled', 'partially-dispatched', 'completed', 'cancelled'],
        default: 'created'
    },
    totalAmount: {
        type: Number,
        min: 0,
        default: 0
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

// Calculate total amount before saving
mainOrderSchema.pre('save', function (next) {
    this.totalAmount = this.items.reduce((total, item) => total + item.totalPrice, 0);
    next();
});

// Indexes for efficient querying
mainOrderSchema.index({ customerId: 1, createdAt: -1 });
mainOrderSchema.index({ status: 1, scheduledDate: 1 });
mainOrderSchema.index({ orderNumber: 1 });

const MainOrder = mongoose.model('MainOrder', mainOrderSchema);

export default MainOrder;
