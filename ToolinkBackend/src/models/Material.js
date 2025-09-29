import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
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
    unit: {
        type: String,
        required: true,
        enum: ['kg', 'ton', 'bag', 'piece']
    },
    sku: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true
    },
    specifications: {
        grade: String,
        brand: String,
        dimensions: String,
        weight: Number
    },
    supplier: {
        name: String,
        contact: String,
        email: String,
        phone: String
    },
    costPrice: {
        type: Number,
        min: 0,
        default: 0
    },
    sellingPrice: {
        type: Number,
        min: 0,
        default: 0
    },
    warehouseCode: {
        type: String,
        required: true,
        trim: true,
        enum: ['W1', 'W2', 'W3', 'WM'],
        default: 'WM'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
materialSchema.index({ category: 1, isActive: 1 });
materialSchema.index({ name: 'text', description: 'text' });

// Virtual for profit margin
materialSchema.virtual('profitMargin').get(function () {
    if (this.costPrice > 0) {
        return ((this.sellingPrice - this.costPrice) / this.costPrice) * 100;
    }
    return 0;
});

const Material = mongoose.model('Material', materialSchema);

export default Material;
