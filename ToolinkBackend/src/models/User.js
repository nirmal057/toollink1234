import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false  // Don't include password in queries by default
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    phone: {
        type: String,
        trim: true,
        match: [/^[\+]?[0-9\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
    },
    role: {
        type: String,
        enum: [
            'admin',           // Full system access
            'warehouse',       // Warehouse management
            'cashier',         // Point of sale operations
            'editor',          // Content management
            'customer',        // Customer access
            'driver',          // Delivery operations
            'user'             // General user access
        ],
        default: 'customer'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    profilePicture: {
        type: String,
        default: null
    },
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        country: { type: String, trim: true, default: 'Sri Lanka' }
    },
    preferences: {
        notifications: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: false },
        language: { type: String, default: 'en' },
        theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' }
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    lastLogin: {
        type: Date
    },
    passwordResetToken: {
        type: String
    },
    passwordResetExpires: {
        type: Date
    },
    emailVerificationToken: {
        type: String
    },
    emailVerificationExpires: {
        type: Date
    },
    refreshTokens: [{
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true }
    }],
    // Admin-specific fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    deletedAt: {
        type: Date,
        default: null
    },
    // Driver-specific fields
    licenseNumber: {
        type: String,
        trim: true
    },
    vehicleInfo: {
        type: {
            type: String,
            trim: true
        },
        plateNumber: {
            type: String,
            trim: true
        },
        capacity: {
            type: String,
            trim: true
        }
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 4.5
    },
    notes: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for user's full profile
userSchema.virtual('profile').get(function () {
    return {
        id: this._id,
        username: this.username,
        email: this.email,
        fullName: this.fullName,
        phone: this.phone,
        role: this.role,
        isActive: this.isActive,
        isApproved: this.isApproved,
        emailVerified: this.emailVerified,
        profilePicture: this.profilePicture,
        address: this.address,
        preferences: this.preferences,
        lastLogin: this.lastLogin,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
});

// Check if user is locked
userSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isApproved: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function () {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account after 5 failed attempts
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + 5 * 60 * 1000 }; // 5 minutes
    }

    return await this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function () {
    return await this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 }
    });
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
    const token = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return token;
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
    const token = crypto.randomBytes(32).toString('hex');

    this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    return token;
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function (identifier) {
    return this.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier }
        ]
    }).select('+password'); // Explicitly include password field
};

// Static method to get user statistics
userSchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
                approvedUsers: { $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] } },
                verifiedUsers: { $sum: { $cond: [{ $eq: ['$emailVerified', true] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                totalUsers: 1,
                activeUsers: 1,
                approvedUsers: 1,
                verifiedUsers: 1,
                inactiveUsers: { $subtract: ['$totalUsers', '$activeUsers'] },
                pendingUsers: { $subtract: ['$totalUsers', '$approvedUsers'] },
                unverifiedUsers: { $subtract: ['$totalUsers', '$verifiedUsers'] }
            }
        }
    ]);

    return stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        approvedUsers: 0,
        verifiedUsers: 0,
        inactiveUsers: 0,
        pendingUsers: 0,
        unverifiedUsers: 0
    };
};

// Static method to get role distribution
userSchema.statics.getRoleDistribution = async function () {
    return await this.aggregate([
        { $match: { isActive: true, isApproved: true } }, // Only count approved users
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
};

const User = mongoose.model('User', userSchema);

export default User;
