import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
    mainOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MainOrder',
        required: true
    },
    subOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubOrder'
    },
    byUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    photoUrl: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: ['delivery', 'quality', 'service', 'other'],
        default: 'other'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    response: {
        text: String,
        byUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        at: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
feedbackSchema.index({ mainOrderId: 1, createdAt: -1 });
feedbackSchema.index({ subOrderId: 1, createdAt: -1 });
feedbackSchema.index({ byUserId: 1, createdAt: -1 });
feedbackSchema.index({ rating: 1, category: 1 });

// Static method to get average rating
feedbackSchema.statics.getAverageRating = async function (filter = {}) {
    const result = await this.aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalFeedbacks: { $sum: 1 }
            }
        }
    ]);

    return result.length > 0 ? result[0] : { averageRating: 0, totalFeedbacks: 0 };
};

// Static method to get rating distribution
feedbackSchema.statics.getRatingDistribution = async function (filter = {}) {
    return this.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$rating',
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
