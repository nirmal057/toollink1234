import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import inventoryRoutes from './src/routes/inventory.js';
import orderRoutes from './src/routes/orders.js';
import deliveryRoutes from './src/routes/delivery.js';
import driversRoutes from './src/routes/drivers.js';
import notificationRoutes from './src/routes/notifications.js';
import reportRoutes from './src/routes/reports.js';
import feedbackRoutes from './src/routes/feedback.js';
import activityRoutes from './src/routes/activity.js';
import adminRoutes from './src/routes/admin.js';
import predictionRoutes from './src/routes/predictions.js';
import messageRoutes from './src/routes/messages.js';
import enhancedRoutes from './src/routes/enhanced.js';
import rolesRoutes from './src/routes/roles.js';

// Import middleware
import { authenticateToken } from './src/middleware/auth.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { notFoundHandler } from './src/middleware/notFoundHandler.js';
import { requestLogger } from './src/middleware/requestLogger.js';
import { corsOptions } from './src/config/cors.js';

// Import utilities
import { createDefaultAdmin } from './src/utils/createDefaultAdmin.js';
import { testEmailConnection } from './src/utils/emailService.js';
import logger from './src/utils/logger.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 5001; // Changed back to 5001

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
}));

// Rate limiting - TEMPORARILY DISABLED FOR DEBUG
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased limit for debugging
    message: 'Too many requests from this IP, please try again later.',
});
// app.use(limiter); // COMMENTED OUT FOR DEBUG

// Compression
app.use(compression());

// Request logging
app.use(requestLogger);

// CORS configuration
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Documentation route
app.get('/api/docs', (req, res) => {
    res.json({
        message: 'ToolLink API Documentation',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            inventory: '/api/inventory',
            orders: '/api/orders',
            delivery: '/api/delivery',
            notifications: '/api/notifications',
            reports: '/api/reports',
            feedback: '/api/feedback',
            activity: '/api/activity',
            admin: '/api/admin',
            predictions: '/api/predictions'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Email test endpoint
app.get('/test-email', async (req, res) => {
    try {
        const result = await testEmailConnection();
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Email service is working correctly',
                details: result.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Email service is not working',
                error: result.message
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to test email service',
            error: error.message
        });
    }
});

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`🔍 Request: ${req.method} ${req.url}`);
    next();
});

// Add comprehensive error handling
process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    if (reason && reason.stack) {
        logger.error('Stack:', reason.stack);
    }
});

process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    if (error && error.stack) {
        logger.error('Stack:', error.stack);
    }
    process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/enhanced', enhancedRoutes);
app.use('/api/roles', rolesRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Connect to MongoDB (LOCAL ONLY)
const MONGODB_LOCAL_URI = 'mongodb://localhost:27017/toollink';
mongoose.connect(MONGODB_LOCAL_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async () => {
        logger.info('Connected to Local MongoDB successfully');
        logger.info(`Database: ${MONGODB_LOCAL_URI}`);

        // Create default admin user
        await createDefaultAdmin();

        // Start server
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`API Documentation: http://localhost:${PORT}/api/docs`);
        });
    })
    .catch((error) => {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    try {
        await mongoose.connection.close();
        logger.info('Database connection closed');
        process.exit(0);
    } catch (error) {
        logger.error('Error closing database connection:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    try {
        await mongoose.connection.close();
        logger.info('Database connection closed');
        process.exit(0);
    } catch (error) {
        logger.error('Error closing database connection:', error);
        process.exit(1);
    }
});

export default app;
