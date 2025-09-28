import mongoose from 'mongoose';

const customerFeedbackSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        maxLength: 1000
    },
    category: {
        type: String,
        enum: ['product_quality', 'delivery_service', 'customer_service', 'website_experience', 'overall', 'other'],
        default: 'overall'
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'responded'],
        default: 'pending'
    },
    adminResponse: {
        type: String,
        maxLength: 1000
    },
    respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    respondedAt: {
        type: Date
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String
    }],
    attachments: [{
        filename: String,
        url: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Index for faster queries
customerFeedbackSchema.index({ customer: 1, createdAt: -1 });
customerFeedbackSchema.index({ rating: 1 });
customerFeedbackSchema.index({ category: 1 });
customerFeedbackSchema.index({ status: 1 });

const CustomerFeedback = mongoose.model('CustomerFeedback', customerFeedbackSchema);

export default CustomerFeedback;
