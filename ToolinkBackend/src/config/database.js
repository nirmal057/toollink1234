/**
 * Database Configuration Module
 * Handles MongoDB connection with retry logic and monitoring
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class DatabaseConnection {
    constructor() {
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 seconds
        this.connectionOptions = {
            // Connection pool settings
            maxPoolSize: 10,
            minPoolSize: 2,

            // Timeout settings
            serverSelectionTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 45000, // 45 seconds
            connectTimeoutMS: 10000, // 10 seconds

            // Heartbeat and monitoring
            heartbeatFrequencyMS: 30000, // 30 seconds

            // Retry settings
            retryWrites: true,
            retryReads: true,

            // Use IPv4 only
            family: 4
        };
    }

    /**
     * Initialize database connection
     */
    async connect() {
        try {
            const mongoUri = this.getConnectionString();

            if (!mongoUri) {
                throw new Error('MongoDB connection string not found. Please set MONGODB_URI in your environment variables.');
            }

            logger.info('🔄 Initializing database connection...');
            this.logConnectionInfo(mongoUri);

            // Connect to MongoDB
            await mongoose.connect(mongoUri, this.connectionOptions);

            this.isConnected = true;
            this.retryCount = 0;

            logger.info('✅ Database connected successfully');
            logger.info(`📊 Database: ${mongoose.connection.db.databaseName}`);
            logger.info(`🏠 Host: ${mongoose.connection.host}`);

            // Setup connection event handlers
            this.setupEventHandlers();

            return true;

        } catch (error) {
            this.isConnected = false;
            this.handleConnectionError(error);
            return false;
        }
    }

    /**
     * Get MongoDB connection string from environment
     * FORCED TO USE LOCAL MONGODB ONLY
     */
    getConnectionString() {
        // Force local MongoDB only - ignore any Atlas configurations
        return 'mongodb://localhost:27017/toollink';
    }

    /**
     * Log connection information (masking credentials)
     */
    logConnectionInfo(uri) {
        const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
        logger.info(`🔗 Connection URI: ${maskedUri}`);

        const isAtlas = uri.includes('mongodb.net') || uri.includes('mongodb+srv');
        const dbType = isAtlas ? 'MongoDB Atlas' : 'Local MongoDB';
        logger.info(`📡 Database Type: ${dbType}`);
    }

    /**
     * Handle connection errors with retry logic
     */
    async handleConnectionError(error) {
        logger.error(`❌ Database connection failed: ${error.message}`);

        // Provide specific error guidance
        if (error.message.includes('authentication failed')) {
            logger.error('🔐 Authentication Error: Check your username and password');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('connection')) {
            logger.error('🌐 Network Error: Check your internet connection and database host');
        } else if (error.message.includes('timeout')) {
            logger.error('⏰ Timeout Error: Database server may be slow or unreachable');
        }

        // Retry logic
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            logger.info(`🔄 Retrying connection (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay / 1000} seconds...`);

            setTimeout(() => {
                this.connect();
            }, this.retryDelay);
        } else {
            logger.error('❌ Maximum retry attempts reached. Database connection failed.');
            logger.error('💡 Server will continue running with limited functionality.');
        }
    }

    /**
     * Setup MongoDB connection event handlers
     */
    setupEventHandlers() {
        mongoose.connection.on('connected', () => {
            this.isConnected = true;
            logger.info('🟢 Database connection established');
        });

        mongoose.connection.on('error', (error) => {
            this.isConnected = false;
            logger.error(`🔴 Database connection error: ${error.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            this.isConnected = false;
            logger.warn('🟡 Database disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            this.isConnected = true;
            logger.info('🟢 Database reconnected successfully');
        });

        mongoose.connection.on('close', () => {
            this.isConnected = false;
            logger.info('🔴 Database connection closed');
        });

        // Handle process termination
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            if (!this.isConnected || mongoose.connection.readyState !== 1) {
                return { success: false, message: 'Database not connected' };
            }

            // Ping the database
            await mongoose.connection.db.admin().ping();

            // Get database stats
            const dbStats = await mongoose.connection.db.stats();

            return {
                success: true,
                message: 'Database connection healthy',
                stats: {
                    database: mongoose.connection.db.databaseName,
                    collections: dbStats.collections,
                    dataSize: Math.round(dbStats.dataSize / 1024) + ' KB',
                    indexSize: Math.round(dbStats.indexSize / 1024) + ' KB'
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Database test failed: ${error.message}`
            };
        }
    }

    /**
     * Get current connection status
     */
    getStatus() {
        const readyStates = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            status: readyStates[mongoose.connection.readyState] || 'unknown',
            database: mongoose.connection.db?.databaseName || 'N/A',
            host: mongoose.connection.host || 'N/A'
        };
    }

    /**
     * Graceful shutdown
     */
    async gracefulShutdown(signal = 'SHUTDOWN') {
        logger.info(`${signal} received. Closing database connection...`);

        try {
            await mongoose.connection.close();
            logger.info('✅ Database connection closed gracefully');
            process.exit(0);
        } catch (error) {
            logger.error(`Error during database shutdown: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Start connection monitoring (optional)
     */
    startMonitoring(intervalMs = 60000) {
        setInterval(() => {
            const status = this.getStatus();
            if (!status.isConnected) {
                logger.warn(`🟡 Database status: ${status.status}`);
            }
        }, intervalMs);
    }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

export default dbConnection;
export { DatabaseConnection };
