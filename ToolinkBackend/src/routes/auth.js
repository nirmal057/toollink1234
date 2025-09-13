import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import PendingCustomer from '../models/PendingCustomer.js';
import { generateTokens, verifyRefreshToken, authenticateToken, requireRole } from '../middleware/auth.js';
import { AuditLogger } from '../middleware/auditLogger.js';
import logger from '../utils/logger.js';
import { sendEmail } from '../utils/emailService.js';
import crypto from 'crypto';

const router = express.Router();

// Validation rules
const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
];

const registerValidation = [
    body('username').trim().isLength({ min: 3, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').trim().isLength({ min: 2, max: 100 }),
    body('phone').optional().matches(/^[\+]?[0-9\-\s\(\)]+$/).isLength({ min: 8, max: 20 }),
    body('role').optional().isIn(['customer', 'user', 'warehouse', 'cashier', 'driver', 'editor'])
];

// Simple test login endpoint
router.post('/test-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔍 Test login request for:', email);

        const user = await User.findByEmailOrUsername(email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        console.log('✅ User found, checking password...');
        const isMatch = await user.comparePassword(password);

        if (isMatch) {
            console.log('✅ Password match! Login successful');
            return res.json({
                success: true,
                message: 'Login successful',
                user: { email: user.email, role: user.role }
            });
        } else {
            console.log('❌ Password mismatch');
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }
    } catch (error) {
        console.error('❌ Test login error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Login endpoint
router.post('/login', loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        } const { email, password } = req.body;

        // Check if this is a pending customer first
        const pendingCustomer = await PendingCustomer.findByEmailOrUsername(email);
        if (pendingCustomer) {
            const submittedDate = new Date(pendingCustomer.submittedAt).toLocaleDateString();
            return res.status(401).json({
                success: false,
                error: `Your account registration (submitted on ${submittedDate}) is pending approval. Please wait for an administrator to approve your registration. You will receive an email notification once approved.`,
                errorType: 'ACCOUNT_PENDING_APPROVAL',
                submittedAt: pendingCustomer.submittedAt
            });
        }

        // Find user by email or username in main database
        const user = await User.findByEmailOrUsername(email);
        if (!user) {
            // Log failed login attempt for non-existent user
            try {
                await AuditLogger.logUserAction(
                    'user_login',
                    null, // No user ID since user doesn't exist
                    null,
                    req,
                    {
                        action: 'login_failed',
                        attemptedEmail: email,
                        reason: 'user_not_found'
                    },
                    'failure'
                );
            } catch (auditError) {
                logger.error('Failed to log login audit for non-existent user:', auditError);
            }

            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                errorType: 'INVALID_CREDENTIALS'
            });
        }

        // Check if account is locked
        if (user.isLocked) {
            return res.status(423).json({
                success: false,
                error: 'Account is temporarily locked due to multiple failed login attempts',
                errorType: 'ACCOUNT_LOCKED'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Account is inactive',
                errorType: 'ACCOUNT_INACTIVE'
            });
        }

        // Check if account is approved
        if (!user.isApproved) {
            return res.status(401).json({
                success: false,
                error: 'Account is pending approval',
                errorType: 'ACCOUNT_PENDING_APPROVAL'
            });
        }

        // Validate password
        let isMatch = false;
        try {
            // Ensure password field is available for comparison
            if (!user.password) {
                logger.error('Password field not available for user:', user.email);
                return res.status(500).json({
                    success: false,
                    error: 'Authentication error',
                    errorType: 'INTERNAL_ERROR'
                });
            }
            isMatch = await user.comparePassword(password);
        } catch (passwordError) {
            logger.error('Password comparison error:', passwordError);
            return res.status(500).json({
                success: false,
                error: 'Authentication error',
                errorType: 'INTERNAL_ERROR'
            });
        }
        if (!isMatch) {
            await user.incLoginAttempts();

            // Log failed login attempt to audit trail
            try {
                await AuditLogger.logUserAction(
                    'user_login',
                    user._id,
                    user._id,
                    req,
                    {
                        action: 'login_failed',
                        userEmail: user.email,
                        reason: 'invalid_password',
                        attemptNumber: (user.loginAttempts || 0) + 1
                    },
                    'failure'
                );
            } catch (auditError) {
                logger.error('Failed to log failed login audit:', auditError);
            }

            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                errorType: 'INVALID_CREDENTIALS'
            });
        }

        // Reset login attempts on successful login
        await user.resetLoginAttempts();

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);

        // Save refresh token
        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

        user.refreshTokens.push({
            token: refreshToken,
            expiresAt: refreshTokenExpiry
        });

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Clean up expired refresh tokens
        user.refreshTokens = user.refreshTokens.filter(token => token.expiresAt > new Date());
        await user.save();

        logger.info(`User ${user.email} logged in successfully`);

        // Log successful login to audit trail
        try {
            await AuditLogger.logUserAction(
                'user_login',
                user._id,
                user._id,
                req,
                {
                    action: 'login_success',
                    userEmail: user.email,
                    userRole: user.role,
                    loginMethod: 'email_password'
                },
                'success'
            );
        } catch (auditError) {
            logger.error('Failed to log login audit:', auditError);
        }

        res.json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isActive: user.isActive,
                isApproved: user.isApproved,
                emailVerified: user.emailVerified,
                profilePicture: user.profilePicture,
                preferences: user.preferences,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            errorType: 'LOGIN_ERROR'
        });
    }
});

// Register endpoint
router.post('/register', registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { username, email, password, fullName, phone, role = 'customer' } = req.body;

        // For customer role: Check pending customers first, then regular users
        if (role === 'customer') {
            // Check if already in pending customers
            const existingPendingCustomer = await PendingCustomer.findByEmailOrUsername(email);
            if (existingPendingCustomer) {
                return res.status(409).json({
                    success: false,
                    error: 'Customer registration already submitted and pending approval',
                    errorType: 'REGISTRATION_PENDING'
                });
            }

            // Check if username is taken in pending customers
            const existingPendingUsername = await PendingCustomer.findOne({ username });
            if (existingPendingUsername) {
                return res.status(409).json({
                    success: false,
                    error: 'Username already taken',
                    errorType: 'USERNAME_TAKEN'
                });
            }

            // Check if user already exists in main database
            const existingUser = await User.findByEmailOrUsername(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: 'User already exists',
                    errorType: 'USER_EXISTS'
                });
            }

            // Check if username is taken in main database
            const existingUsernameInMain = await User.findOne({ username });
            if (existingUsernameInMain) {
                return res.status(409).json({
                    success: false,
                    error: 'Username already taken',
                    errorType: 'USERNAME_TAKEN'
                });
            }

            // Create pending customer (NOT in main users database)
            const pendingCustomer = new PendingCustomer({
                username,
                email,
                password,
                fullName,
                phone,
                role,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            await pendingCustomer.save();

            logger.info(`New customer registration submitted for approval: ${email}`);

            // Send welcome email to the new customer
            try {
                await sendEmail({
                    to: email,
                    template: 'customer-registration-pending',
                    data: {
                        fullName,
                        email,
                        submittedAt: pendingCustomer.submittedAt
                    }
                });
                logger.info(`Welcome email sent to new customer: ${email}`);
            } catch (emailError) {
                logger.error('Failed to send welcome email to customer:', emailError);
            }

            // Send notification to admins/cashiers about new pending customer
            try {
                const adminUsers = await User.find({
                    role: { $in: ['admin', 'cashier'] },
                    isActive: true
                }).select('email fullName');

                for (const admin of adminUsers) {
                    await sendEmail({
                        to: admin.email,
                        template: 'admin-new-customer-pending',
                        data: {
                            customerName: fullName,
                            customerEmail: email,
                            approvalUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer-approval`
                        }
                    });
                }
                logger.info(`Admin notification emails sent for new customer: ${email}`);
            } catch (emailError) {
                logger.error('Failed to send admin notification emails:', emailError);
            }

            return res.status(201).json({
                success: true,
                message: 'Registration submitted successfully. Your account is pending approval by an admin or cashier. You will receive an email notification once your account is approved.',
                requiresApproval: true,
                status: 'pending',
                pendingCustomer: {
                    id: pendingCustomer._id,
                    email: pendingCustomer.email,
                    fullName: pendingCustomer.fullName,
                    submittedAt: pendingCustomer.submittedAt
                }
            });
        }

        // For non-customer roles (admin, cashier, etc.) - create directly in main database
        // Check if user already exists
        const existingUser = await User.findByEmailOrUsername(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User already exists',
                errorType: 'USER_EXISTS'
            });
        }

        // Check if username is taken
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({
                success: false,
                error: 'Username already taken',
                errorType: 'USERNAME_TAKEN'
            });
        }

        // Create new user (for non-customer roles)
        const user = new User({
            username,
            email,
            password,
            fullName,
            phone,
            role,
            isApproved: true, // Non-customers are auto-approved
            emailVerified: false
        });

        // Generate email verification token
        const verificationToken = user.generateEmailVerificationToken();
        await user.save();

        // Send verification email
        try {
            await sendEmail({
                to: user.email,
                subject: 'Verify your email address',
                template: 'email-verification',
                data: {
                    fullName: user.fullName,
                    verificationToken,
                    verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
                }
            });
        } catch (emailError) {
            logger.error('Email verification sending failed:', emailError);
        }

        logger.info(`New user registered: ${user.email}`);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            requiresApproval: false,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isActive: user.isActive,
                isApproved: user.isApproved,
                emailVerified: user.emailVerified
            }
        });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed',
            errorType: 'REGISTRATION_ERROR'
        });
    }
});

// Refresh token endpoint
router.post('/refresh-token', verifyRefreshToken, async (req, res) => {
    try {
        const { user, refreshToken } = req;

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

        // Remove old refresh token and add new one
        user.refreshTokens = user.refreshTokens.filter(token => token.token !== refreshToken);

        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

        user.refreshTokens.push({
            token: newRefreshToken,
            expiresAt: refreshTokenExpiry
        });

        await user.save();

        res.json({
            success: true,
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed',
            errorType: 'TOKEN_REFRESH_ERROR'
        });
    }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        let user = null;

        if (refreshToken) {
            // Find user and remove refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            user = await User.findById(decoded.userId);

            if (user) {
                user.refreshTokens = user.refreshTokens.filter(token => token.token !== refreshToken);
                await user.save();

                // Log successful logout to audit trail
                try {
                    await AuditLogger.logUserAction(
                        'user_logout',
                        user._id,
                        user._id,
                        req,
                        {
                            action: 'logout_success',
                            userEmail: user.email,
                            userRole: user.role
                        },
                        'success'
                    );
                } catch (auditError) {
                    logger.error('Failed to log logout audit:', auditError);
                }
            }
        }

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        logger.error('Logout error:', error);
        res.json({
            success: true,
            message: 'Logout successful'
        });
    }
});

// Get current user endpoint
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required',
                errorType: 'MISSING_TOKEN'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -refreshTokens');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found',
                errorType: 'USER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isActive: user.isActive,
                isApproved: user.isApproved,
                emailVerified: user.emailVerified,
                profilePicture: user.profilePicture,
                preferences: user.preferences,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        logger.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user information',
            errorType: 'GET_USER_ERROR'
        });
    }
});

// Forgot password endpoint
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({
                success: true,
                message: 'If a user with that email exists, a password reset link has been sent.'
            });
        }

        // Generate reset token
        const resetToken = user.generatePasswordResetToken();
        await user.save();

        // Send reset email
        try {
            await sendEmail({
                to: user.email,
                subject: 'Password Reset Request',
                template: 'password-reset',
                data: {
                    fullName: user.fullName,
                    resetToken,
                    resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
                }
            });
        } catch (emailError) {
            logger.error('Password reset email sending failed:', emailError);
        }

        res.json({
            success: true,
            message: 'If a user with that email exists, a password reset link has been sent.'
        });
    } catch (error) {
        logger.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process password reset request',
            errorType: 'FORGOT_PASSWORD_ERROR'
        });
    }
});

// Reset password endpoint
router.post('/reset-password', [
    body('token').notEmpty(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { token, password } = req.body;

        // Hash the token
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid reset token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token',
                errorType: 'INVALID_RESET_TOKEN'
            });
        }

        // Update password
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.loginAttempts = 0;
        user.lockUntil = undefined;

        await user.save();

        logger.info(`Password reset successful for user: ${user.email}`);

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password',
            errorType: 'RESET_PASSWORD_ERROR'
        });
    }
});

// Verify email endpoint
router.post('/verify-email', [
    body('token').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { token } = req.body;

        // Hash the token
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid verification token
        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification token',
                errorType: 'INVALID_VERIFICATION_TOKEN'
            });
        }

        // Verify email
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;

        await user.save();

        logger.info(`Email verification successful for user: ${user.email}`);

        res.json({
            success: true,
            message: 'Email verification successful'
        });
    } catch (error) {
        logger.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify email',
            errorType: 'EMAIL_VERIFICATION_ERROR'
        });
    }
});

// Get pending users (customers waiting for approval)
router.get('/pending-users', authenticateToken, requireRole(['admin', 'cashier']), async (req, res) => {
    try {
        const pendingCustomers = await PendingCustomer.find({
            status: 'pending'
        }).select('-password').sort({ submittedAt: -1 });

        logger.info(`Found ${pendingCustomers.length} pending customers for approval`);

        res.json({
            success: true,
            users: pendingCustomers,
            count: pendingCustomers.length
        });
    } catch (error) {
        logger.error('Error fetching pending customers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending customers',
            errorType: 'FETCH_PENDING_CUSTOMERS_ERROR'
        });
    }
});

// Approve user
router.post('/approve-user', [
    body('userId').notEmpty()
], authenticateToken, requireRole(['admin', 'cashier']), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { userId } = req.body;

        // Find pending customer
        const pendingCustomer = await PendingCustomer.findById(userId);
        if (!pendingCustomer) {
            return res.status(404).json({
                success: false,
                error: 'Pending customer not found',
                errorType: 'PENDING_CUSTOMER_NOT_FOUND'
            });
        }

        // Check if customer already exists in main database (safety check)
        const existingUser = await User.findByEmailOrUsername(pendingCustomer.email);
        if (existingUser) {
            // Remove from pending and return error
            await PendingCustomer.findByIdAndDelete(userId);
            return res.status(409).json({
                success: false,
                error: 'Customer already exists in main database',
                errorType: 'CUSTOMER_ALREADY_EXISTS'
            });
        }

        // Create user in main database from pending customer data
        const userData = pendingCustomer.toUserData();
        const user = new User(userData);

        // Skip password hashing since it's already hashed in PendingCustomer
        user.isModified = function (path) {
            if (path === 'password') return false;
            return this.constructor.prototype.isModified.call(this, path);
        };

        // Generate email verification token
        const verificationToken = user.generateEmailVerificationToken();
        await user.save();

        // Remove from pending customers collection
        await PendingCustomer.findByIdAndDelete(userId);

        // Log the approval action
        logger.info(`Customer ${pendingCustomer.email} approved by ${req.user.email} and moved to main database`);

        // Send approval notification email
        try {
            await sendEmail({
                to: user.email,
                template: 'customer-approved',
                data: {
                    fullName: user.fullName,
                    email: user.email,
                    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/login`,
                    verificationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`
                }
            });
            logger.info(`Approval email sent to customer: ${user.email}`);
        } catch (emailError) {
            logger.error('Failed to send approval email:', emailError);
        }

        res.json({
            success: true,
            message: 'Customer approved successfully and account created',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isApproved: user.isApproved,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        logger.error('Error approving customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve customer',
            errorType: 'CUSTOMER_APPROVAL_ERROR'
        });
    }
});

// Reject user
router.post('/reject-user', [
    body('userId').notEmpty(),
    body('reason').optional().isString()
], authenticateToken, requireRole(['admin', 'cashier']), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { userId, reason = 'No reason provided' } = req.body;

        // Find pending customer
        const pendingCustomer = await PendingCustomer.findById(userId);
        if (!pendingCustomer) {
            return res.status(404).json({
                success: false,
                error: 'Pending customer not found',
                errorType: 'PENDING_CUSTOMER_NOT_FOUND'
            });
        }

        // Log the rejection action
        logger.info(`Pending customer ${pendingCustomer.email} rejected by ${req.user.email}. Reason: ${reason}`);

        // Send rejection notification email
        try {
            await sendEmail({
                to: pendingCustomer.email,
                subject: 'Account Registration Update - ToolLink',
                template: 'account-rejected',
                data: {
                    fullName: pendingCustomer.fullName,
                    reason: reason,
                    supportEmail: process.env.SUPPORT_EMAIL || 'support@toollink.com'
                }
            });
        } catch (emailError) {
            logger.error('Failed to send rejection email:', emailError);
        }

        // Delete the pending customer
        await PendingCustomer.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'Customer registration rejected and removed successfully'
        });
    } catch (error) {
        logger.error('Error rejecting customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject customer',
            errorType: 'CUSTOMER_REJECTION_ERROR'
        });
    }
});

// Get pending customer details by ID
router.get('/pending-customer/:id', authenticateToken, requireRole(['admin', 'cashier']), async (req, res) => {
    try {
        const { id } = req.params;

        const pendingCustomer = await PendingCustomer.findById(id).select('-password');
        if (!pendingCustomer) {
            return res.status(404).json({
                success: false,
                error: 'Pending customer not found',
                errorType: 'PENDING_CUSTOMER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            customer: pendingCustomer
        });
    } catch (error) {
        logger.error('Error fetching pending customer details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer details',
            errorType: 'FETCH_CUSTOMER_DETAILS_ERROR'
        });
    }
});

export default router;
