import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    category: {
        type: String,
        required: true,
        trim: true,
        enum: [
            'Cement',
            'Steel & Reinforcement',
            'Paint & Chemicals',
            'Electrical Items',
            'Plumbing Supplies',
            'Tools & Equipment',
            'Hardware & Fasteners',
            'Tiles & Ceramics',
            'Roofing Materials',
            'Safety Equipment',
            'Sand & Aggregate',
            'Bricks',
            'Stones',
            'Materials',
            'Other'
        ]
    },
    warehouse: {
        type: String,
        required: true,
        trim: true,
        enum: [
            'warehouse1',  // River sand/soil
            'warehouse2',  // Bricks
            'warehouse3',  // Metals
            'main_warehouse' // Tools & Equipment
        ],
        default: 'main_warehouse'
    },
    sku: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    current_stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    unit: {
        type: String,
        required: true,
        trim: true,
        enum: ['pieces', 'kg', 'liters', 'meters', 'boxes', 'sets', 'pairs', 'rolls', 'sheets', 'units']
    },
    threshold: {
        type: Number,
        required: true,
        min: 0,
        default: 10
    },
    min_stock_level: {
        type: Number,
        required: true,
        min: 0,
        default: 10
    },
    max_stock_level: {
        type: Number,
        required: true,
        min: 0,
        default: 1000
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    supplier_info: {
        name: { type: String, trim: true },
        contact: { type: String, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },
        address: { type: String, trim: true }
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'discontinued'],
        default: 'active'
    },
    low_stock_alert: {
        type: Boolean,
        default: true
    },
    barcode: {
        type: String,
        trim: true
    },
    weight: {
        type: Number,
        min: 0
    },
    dimensions: {
        length: { type: Number, min: 0 },
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 },
        unit: { type: String, default: 'cm' }
    },
    images: [{
        url: { type: String, trim: true },
        alt: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false }
    }],
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    deletedAt: {
        type: Date,
        default: null
    },
    notes: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for checking if item is low stock
inventorySchema.virtual('isLowStock').get(function () {
    return this.current_stock <= this.min_stock_level;
});

// Virtual for stock status
inventorySchema.virtual('stockStatus').get(function () {
    if (this.current_stock === 0) return 'out_of_stock';
    if (this.current_stock <= this.min_stock_level) return 'low_stock';
    if (this.current_stock >= this.max_stock_level) return 'overstocked';
    return 'in_stock';
});

// Virtual for stock percentage
inventorySchema.virtual('stockPercentage').get(function () {
    if (this.max_stock_level === 0) return 0;
    return Math.round((this.current_stock / this.max_stock_level) * 100);
});

// Index for performance
inventorySchema.index({ name: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ sku: 1 });
inventorySchema.index({ status: 1 });
inventorySchema.index({ current_stock: 1 });
inventorySchema.index({ min_stock_level: 1 });
inventorySchema.index({ created_at: -1 });
inventorySchema.index({ deletedAt: 1 });

// Pre-save middleware to generate SKU if not provided
inventorySchema.pre('save', function (next) {
    if (!this.sku) {
        // Generate SKU from category and name
        const categoryCode = this.category.substring(0, 3).toUpperCase();
        const nameCode = this.name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        this.sku = `${categoryCode}${nameCode}${timestamp}`;
    }

    // Sync quantity with current_stock
    if (this.isModified('quantity')) {
        this.current_stock = this.quantity;
    }

    next();
});

// Static method to get inventory statistics
inventorySchema.statics.getStatistics = async function (filter = {}) {
    const matchFilter = { ...filter };

    const stats = await this.aggregate([
        { $match: matchFilter },
        {
            $group: {
                _id: null,
                totalItems: { $sum: 1 },
                activeItems: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                inactiveItems: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
                lowStockItems: { $sum: { $cond: [{ $lte: ['$current_stock', '$min_stock_level'] }, 1, 0] } },
                outOfStockItems: { $sum: { $cond: [{ $eq: ['$current_stock', 0] }, 1, 0] } },
                totalValue: { $sum: { $multiply: ['$current_stock', { $ifNull: ['$unit_price', '$cost', 0] }] } },
                totalQuantity: { $sum: '$current_stock' }
            }
        }
    ]);

    // Get category distribution with same filter
    const categoryStats = await this.aggregate([
        { $match: { ...matchFilter, status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    const result = stats[0] || {
        totalItems: 0,
        activeItems: 0,
        inactiveItems: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        totalValue: 0,
        totalQuantity: 0
    };

    result.categories = categoryStats.length;
    result.categoryDistribution = categoryStats;

    return result;
};

// Static method to get low stock items
inventorySchema.statics.getLowStockItems = async function () {
    return await this.find({
        status: 'active',
        $expr: { $lte: ['$current_stock', '$min_stock_level'] },
        low_stock_alert: true
    })
        .populate('created_by', 'fullName email')
        .populate('updated_by', 'fullName email')
        .sort({ current_stock: 1 });
};

// Static method to search inventory
inventorySchema.statics.searchInventory = async function (query, options = {}) {
    const {
        category,
        status = 'active',
        location,
        warehouse,
        lowStock = false,
        page = 1,
        limit = 10,
        sort = 'name'
    } = options;

    const filter = {
        status
    };

    if (query) {
        filter.$or = [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { sku: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
        ];
    }

    if (category) {
        filter.category = category;
    }

    if (location) {
        filter.location = { $regex: location, $options: 'i' };
    }

    // Add warehouse filtering
    if (warehouse) {
        filter.warehouse = warehouse;
    }

    if (lowStock) {
        filter.$expr = { $lte: ['$current_stock', '$min_stock_level'] };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        this.find(filter)
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email')
            .sort(sort)
            .skip(skip)
            .limit(limit),
        this.countDocuments(filter)
    ]);

    return {
        items,
        total,
        page,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
    };
};

const Inventory = mongoose.model('Inventory', inventorySchema);

export default Inventory;
