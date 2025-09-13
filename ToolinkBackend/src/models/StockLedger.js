import mongoose from 'mongoose';

const stockLedgerSchema = new mongoose.Schema({
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true
    },
    materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['stock-in', 'stock-out', 'adjustment']
    },
    qty: {
        type: Number,
        required: true
    },
    note: {
        type: String,
        trim: true,
        maxlength: 500
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        // Can reference SubOrder, PurchaseOrder, etc.
    },
    referenceType: {
        type: String,
        enum: ['SubOrder', 'PurchaseOrder', 'Transfer', 'Manual']
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    runningBalance: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Compound indexes for efficient querying
stockLedgerSchema.index({ warehouseId: 1, materialId: 1, createdAt: -1 });
stockLedgerSchema.index({ warehouseId: 1, createdAt: -1 });
stockLedgerSchema.index({ materialId: 1, createdAt: -1 });

// Static method to get current stock for a material in a warehouse
stockLedgerSchema.statics.getCurrentStock = async function (warehouseId, materialId) {
    const latestEntry = await this.findOne({
        warehouseId,
        materialId
    }).sort({ createdAt: -1 });

    return latestEntry ? latestEntry.runningBalance : 0;
};

// Static method to get stock movements for a period
stockLedgerSchema.statics.getMovements = async function (warehouseId, materialId, startDate, endDate) {
    const query = { warehouseId, materialId };

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
    }

    return this.find(query).sort({ createdAt: -1 }).populate('recordedBy', 'username');
};

const StockLedger = mongoose.model('StockLedger', stockLedgerSchema);

export default StockLedger;
