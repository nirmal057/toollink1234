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

// Profit margin calculation removed as pricing is not needed

const Material = mongoose.model('Material', materialSchema);

export default Material;
