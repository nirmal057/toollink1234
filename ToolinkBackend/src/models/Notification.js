import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    toRole: {
        type: String,
        enum: ['ADMIN', 'WAREHOUSE_MANAGER', 'CASHIER', 'EDITOR', 'CUSTOMER']
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['LOW_STOCK', 'UPCOMING_DELIVERY', 'DELIVERY_DELAYED', 'ORDER_STATUS_CHANGE', 'MATERIAL_REFILL_NEEDED', 'SYSTEM'],
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 1000
    },
    meta: mongoose.Schema.Types.Mixed, // Additional data related to notification
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    expiresAt: Date
}, {
    timestamps: true
});

// Indexes
notificationSchema.index({ toUserId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ toRole: 1, read: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
