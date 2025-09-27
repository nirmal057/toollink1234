import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const subOrderSchema = new mongoose.Schema({
    subOrderNumber: {
        type: String,
        unique: true,
        required: true
    },
    mainOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MainOrder',
        required: true
    },
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true
    },
    materialCategory: {
        type: String,
        required: true,
        enum: [
            'Cement',
            'Steel & Reinforcement',
            'Aggregates',
            'Bricks & Blocks',
            'Roofing Materials',
            'Electrical',
            'Plumbing',
            'Paint & Chemicals',
            'Tools & Equipment',
            'Safety Equipment',
            'Hardware & Fasteners',
            'Other'
        ]
    },
    items: [{
        materialId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Material',
            required: true
        },
        materialName: {
            type: String,
            required: true
        },
        qty: {
            type: Number,
            required: true,
            min: 1
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
    totalAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    scheduledAt: {
        type: Date,
        required: true
    },
    scheduledTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    estimatedDuration: {
        type: Number,
        default: 60, // minutes
        min: 15,
        max: 480
    },
    deliverySequence: {
        type: Number,
        default: 1,
        min: 1
    },
    status: {
        type: String,
        required: true,
        enum: ['created', 'scheduled', 'prepared', 'dispatched', 'delivered', 'failed', 'rescheduled'],
        default: 'created'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    history: [{
        at: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            required: true
        },
        byUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        note: {
            type: String,
            trim: true,
            maxlength: 500
        }
    }],
    deliveryProof: {
        signature: String,
        photo: String,
        receivedBy: String,
        timestamp: Date
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000
    }
}, {
    timestamps: true
});

// Generate sub-order number
subOrderSchema.pre('save', async function (next) {
    if (!this.subOrderNumber) {
        const mainOrder = await mongoose.model('MainOrder').findById(this.mainOrderId);
        if (mainOrder) {
            const count = await this.constructor.countDocuments({ mainOrderId: this.mainOrderId });
            this.subOrderNumber = `${mainOrder.orderNumber}-${String(count + 1).padStart(2, '0')}`;
        }
    }
    next();
});

// Calculate total amount before saving
subOrderSchema.pre('save', function (next) {
    if (this.items && this.items.length > 0) {
        this.totalAmount = this.items.reduce((total, item) => {
            return total + (item.qty * item.unitPrice);
        }, 0);
    }
    next();
});

// Method to add history entry
subOrderSchema.methods.addHistory = function (action, byUserId, note = '') {
    this.history.push({
        action,
        byUserId,
        note,
        at: new Date()
    });
    return this.save();
};

// Method to update status with history
subOrderSchema.methods.updateStatus = function (newStatus, byUserId, note = '') {
    const oldStatus = this.status;
    this.status = newStatus;
    return this.addHistory(`Status changed from ${oldStatus} to ${newStatus}`, byUserId, note);
};

// Add pagination plugin
subOrderSchema.plugin(mongoosePaginate);

// Indexes for efficient querying
subOrderSchema.index({ mainOrderId: 1 });
subOrderSchema.index({ warehouseId: 1, status: 1, scheduledAt: 1 });
subOrderSchema.index({ status: 1, scheduledAt: 1 });
subOrderSchema.index({ subOrderNumber: 1 });

const SubOrder = mongoose.model('SubOrder', subOrderSchema);

export default SubOrder;
