import express from 'express';
import mongoose from 'mongoose';
import Delivery from '../models/Delivery.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendEmail } from '../utils/emailService.js';
import NotificationService from '../services/NotificationService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Middleware for role-based authorization
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }
        next();
    };
};

// ============================================================================
// DELIVERY MANAGEMENT ROUTES - Role-based functionality
// ============================================================================

/**
 * GET /api/delivery-management/deliveries
 * Get deliveries based on user role and permissions
 */
router.get('/deliveries', authenticateToken, async (req, res) => {
    try {
        const { role, id: userId, email } = req.user;
        const {
            status,
            priority,
            warehouse,
            driver,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 10,
            sortBy = 'deliveryDate',
            sortOrder = 'desc'
        } = req.query;

        let query = {};
        let populateOptions = [
            {
                path: 'orderId',
                select: 'orderNumber totalAmount items customerInfo'
            },
            {
                path: 'assignedDriver',
                select: 'fullName phone email vehicleInfo rating'
            },
            {
                path: 'createdBy',
                select: 'fullName email role'
            }
        ];

        // Role-based filtering
        switch (role) {
            case 'customer':
                query.customerEmail = email;
                break;

            case 'driver':
                // Find driver record
                const driverUser = await User.findById(userId).select('_id');
                if (!driverUser) {
                    return res.status(404).json({
                        success: false,
                        message: 'Driver profile not found'
                    });
                }
                query.assignedDriver = driverUser._id;
                break;

            case 'warehouse':
                // Warehouse users see deliveries from their warehouse
                const warehouseUser = await User.findById(userId).select('warehouseId');
                if (warehouseUser.warehouseId) {
                    query.warehouseId = warehouseUser.warehouseId;
                }
                break;

            case 'cashier':
            case 'admin':
                // Admin and cashier can see all deliveries
                break;

            default:
                return res.status(403).json({
                    success: false,
                    message: 'Invalid user role'
                });
        }

        // Apply filters
        if (status && status !== 'all') {
            query.status = status;
        }

        if (priority && priority !== 'all') {
            query.priority = priority;
        }

        if (warehouse && warehouse !== 'all') {
            query.warehouseId = warehouse;
        }

        if (driver && driver !== 'all') {
            query.assignedDriver = driver;
        }

        if (startDate && endDate) {
            query.deliveryDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { trackingNumber: searchRegex },
                { customerName: searchRegex },
                { customerEmail: searchRegex },
                { 'deliveryAddress.street': searchRegex },
                { 'deliveryAddress.city': searchRegex }
            ];
        }

        // Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Sort options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query
        const [deliveries, totalCount] = await Promise.all([
            Delivery.find(query)
                .populate(populateOptions)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Delivery.countDocuments(query)
        ]);

        // Format response
        const formattedDeliveries = deliveries.map(delivery => ({
            id: delivery._id,
            trackingNumber: delivery.trackingNumber,
            orderId: delivery.orderId?._id,
            orderNumber: delivery.orderId?.orderNumber,
            warehouseName: delivery.warehouseName,
            warehouseId: delivery.warehouseId,
            items: delivery.items || [],
            deliveryDate: delivery.deliveryDate,
            timeSlot: delivery.timeSlot,
            status: delivery.status,
            priority: delivery.priority || 'normal',
            deliveryAddress: delivery.deliveryAddress,
            customerName: delivery.customerName,
            customerEmail: delivery.customerEmail,
            contactNumber: delivery.contactNumber,
            alternateContact: delivery.alternateContact,
            specialInstructions: delivery.specialInstructions,
            statusHistory: delivery.statusHistory || [],
            assignedDriver: delivery.assignedDriver ? {
                id: delivery.assignedDriver._id,
                name: delivery.assignedDriver.fullName,
                phone: delivery.assignedDriver.phone,
                email: delivery.assignedDriver.email,
                vehicleInfo: delivery.assignedDriver.vehicleInfo,
                rating: delivery.assignedDriver.rating || 4.5
            } : null,
            estimatedDeliveryTime: delivery.estimatedDeliveryTime,
            actualDeliveryTime: delivery.actualDeliveryTime,
            deliveryProof: delivery.deliveryProof,
            signature: delivery.signature,
            driverNotes: delivery.driverNotes,
            customerNotes: delivery.customerNotes,
            adminNotes: delivery.adminNotes,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt,
            createdBy: delivery.createdBy?.fullName || 'System'
        }));

        res.json({
            success: true,
            deliveries: formattedDeliveries,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum),
                totalItems: totalCount,
                itemsPerPage: limitNum
            }
        });

    } catch (error) {
        logger.error('Error fetching deliveries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch deliveries',
            error: error.message
        });
    }
});

/**
 * GET /api/delivery-management/deliveries/:id
 * Get single delivery details
 */
router.get('/deliveries/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { role, id: userId, email } = req.user;

        const delivery = await Delivery.findById(id)
            .populate('orderId', 'orderNumber totalAmount items customerInfo')
            .populate('assignedDriver', 'fullName phone email vehicleInfo rating')
            .populate('createdBy', 'fullName email role')
            .populate('updatedBy', 'fullName email role');

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Role-based access control
        switch (role) {
            case 'customer':
                if (delivery.customerEmail !== email) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied. You can only view your own deliveries.'
                    });
                }
                break;

            case 'driver':
                if (!delivery.assignedDriver || delivery.assignedDriver._id.toString() !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied. You can only view your assigned deliveries.'
                    });
                }
                break;

            case 'warehouse':
                const warehouseUser = await User.findById(userId).select('warehouseId');
                if (warehouseUser.warehouseId && delivery.warehouseId !== warehouseUser.warehouseId) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied. You can only view deliveries from your warehouse.'
                    });
                }
                break;

            case 'cashier':
            case 'admin':
                // Full access
                break;

            default:
                return res.status(403).json({
                    success: false,
                    message: 'Invalid user role'
                });
        }

        res.json({
            success: true,
            delivery: {
                id: delivery._id,
                trackingNumber: delivery.trackingNumber,
                orderId: delivery.orderId?._id,
                orderNumber: delivery.orderId?.orderNumber,
                warehouseName: delivery.warehouseName,
                items: delivery.items || [],
                deliveryDate: delivery.deliveryDate,
                timeSlot: delivery.timeSlot,
                status: delivery.status,
                priority: delivery.priority || 'normal',
                deliveryAddress: delivery.deliveryAddress,
                customerName: delivery.customerName,
                customerEmail: delivery.customerEmail,
                contactNumber: delivery.contactNumber,
                alternateContact: delivery.alternateContact,
                specialInstructions: delivery.specialInstructions,
                statusHistory: delivery.statusHistory || [],
                assignedDriver: delivery.assignedDriver,
                estimatedDeliveryTime: delivery.estimatedDeliveryTime,
                actualDeliveryTime: delivery.actualDeliveryTime,
                deliveryProof: delivery.deliveryProof,
                signature: delivery.signature,
                driverNotes: delivery.driverNotes,
                customerNotes: delivery.customerNotes,
                adminNotes: delivery.adminNotes,
                createdAt: delivery.createdAt,
                updatedAt: delivery.updatedAt,
                createdBy: delivery.createdBy,
                updatedBy: delivery.updatedBy
            }
        });

    } catch (error) {
        logger.error('Error fetching delivery details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery details',
            error: error.message
        });
    }
});

/**
 * PUT /api/delivery-management/deliveries/:id/status
 * Update delivery status (role-based permissions)
 */
router.put('/deliveries/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, location } = req.body;
        const { role, id: userId } = req.user;

        // Validate status
        const validStatuses = ['scheduled', 'assigned', 'out_from_warehouse', 'on_the_way', 'delivered', 'failed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const delivery = await Delivery.findById(id)
            .populate('assignedDriver', 'fullName phone email');

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Role-based status update permissions
        const allowedTransitions = {
            admin: ['scheduled', 'assigned', 'out_from_warehouse', 'on_the_way', 'delivered', 'failed', 'cancelled'],
            warehouse: ['scheduled', 'assigned', 'out_from_warehouse', 'cancelled'],
            cashier: ['scheduled', 'assigned', 'cancelled'],
            driver: ['out_from_warehouse', 'on_the_way', 'delivered', 'failed']
        };

        if (!allowedTransitions[role] || !allowedTransitions[role].includes(status)) {
            return res.status(403).json({
                success: false,
                message: `Your role (${role}) is not authorized to set status to ${status}`
            });
        }

        // For drivers, ensure they can only update their own deliveries
        if (role === 'driver' && (!delivery.assignedDriver || delivery.assignedDriver._id.toString() !== userId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only update status of your assigned deliveries'
            });
        }

        // Update delivery status using model method
        await delivery.updateStatus(status, userId, notes || '');

        // Update location if provided (for drivers)
        if (location && role === 'driver') {
            delivery.currentLocation = location;
        }

        // Handle specific status updates
        switch (status) {
            case 'delivered':
                delivery.actualDeliveryTime = new Date();
                // Update related order status
                if (delivery.orderId) {
                    await Order.findByIdAndUpdate(delivery.orderId, {
                        status: 'delivered',
                        deliveredAt: new Date()
                    });
                }
                break;

            case 'out_from_warehouse':
                delivery.departedWarehouseAt = new Date();
                break;

            case 'failed':
                // Send notification to admin/warehouse about failed delivery
                await NotificationService.create(
                    'ADMIN',
                    null,
                    'DELIVERY_FAILED',
                    `Delivery ${delivery.trackingNumber} has failed. Customer: ${delivery.customerName}`,
                    {
                        deliveryId: delivery._id,
                        trackingNumber: delivery.trackingNumber,
                        customerName: delivery.customerName,
                        reason: notes || 'No reason provided'
                    }
                );
                break;
        }

        await delivery.save();

        // Send status update notifications
        try {
            await NotificationService.sendDeliveryNotification(delivery._id, status, {
                notes,
                location,
                updatedBy: req.user.fullName || req.user.email
            });
        } catch (notificationError) {
            logger.error('Failed to send delivery notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.json({
            success: true,
            message: 'Delivery status updated successfully',
            delivery: {
                id: delivery._id,
                trackingNumber: delivery.trackingNumber,
                status: delivery.status,
                statusHistory: delivery.statusHistory,
                updatedAt: delivery.updatedAt
            }
        });

    } catch (error) {
        logger.error('Error updating delivery status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update delivery status',
            error: error.message
        });
    }
});

/**
 * POST /api/delivery-management/deliveries/:id/assign
 * Assign driver to delivery (Admin/Warehouse/Cashier only)
 */
router.post('/deliveries/:id/assign', authenticateToken, authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { id } = req.params;
        const { driverId } = req.body;
        const { id: userId } = req.user;

        // Validate delivery exists
        const delivery = await Delivery.findById(id);
        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Validate driver exists and is available
        const driver = await User.findById(driverId);
        if (!driver || driver.role !== 'driver') {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        if (driver.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Driver is not available for assignments'
            });
        }

        // Check driver workload
        const activeDeliveries = await Delivery.countDocuments({
            assignedDriver: driverId,
            status: { $in: ['assigned', 'out_from_warehouse', 'on_the_way'] }
        });

        const maxDeliveries = driver.maxDeliveries || 5;
        if (activeDeliveries >= maxDeliveries) {
            return res.status(400).json({
                success: false,
                message: `Driver has reached maximum delivery capacity (${maxDeliveries})`
            });
        }

        // Assign driver to delivery
        delivery.assignedDriver = driverId;
        delivery.status = 'assigned';
        delivery.assignedDate = new Date();
        delivery.updatedBy = userId;

        // Add status history entry
        delivery.statusHistory.push({
            status: 'assigned',
            updatedBy: userId,
            notes: `Assigned to driver ${driver.fullName}`,
            timestamp: new Date()
        });

        await delivery.save();

        // Update driver availability
        driver.isAvailable = activeDeliveries + 1 < maxDeliveries;
        await driver.save();

        // Send notification to driver
        try {
            await sendEmail(
                driver.email,
                'New Delivery Assignment - ToolLink',
                `
                <h2>🚛 New Delivery Assignment</h2>
                <p>Hi ${driver.fullName},</p>
                <p>You have been assigned a new delivery:</p>

                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3>📦 Delivery Details:</h3>
                    <p><strong>Tracking Number:</strong> ${delivery.trackingNumber}</p>
                    <p><strong>Customer:</strong> ${delivery.customerName}</p>
                    <p><strong>Delivery Address:</strong> ${delivery.deliveryAddress.street}, ${delivery.deliveryAddress.city}</p>
                    <p><strong>Delivery Date:</strong> ${new Date(delivery.deliveryDate).toLocaleDateString()}</p>
                    <p><strong>Time Slot:</strong> ${delivery.timeSlot}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/delivery-management"
                       style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Delivery Details
                    </a>
                </div>

                <p>Please check the delivery management system for full details and delivery instructions.</p>
                <p>Thank you!</p>
                `
            );

            // Send notification through notification service
            await NotificationService.create(
                'DRIVER',
                driverId,
                'DELIVERY_ASSIGNED',
                `New delivery assignment: ${delivery.trackingNumber}`,
                {
                    deliveryId: delivery._id,
                    trackingNumber: delivery.trackingNumber,
                    customerName: delivery.customerName,
                    deliveryDate: delivery.deliveryDate,
                    timeSlot: delivery.timeSlot
                }
            );
        } catch (emailError) {
            logger.error('Failed to send assignment notification:', emailError);
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: 'Driver assigned successfully',
            delivery: {
                id: delivery._id,
                trackingNumber: delivery.trackingNumber,
                status: delivery.status,
                assignedDriver: {
                    id: driver._id,
                    name: driver.fullName,
                    phone: driver.phone,
                    email: driver.email,
                    vehicleInfo: driver.vehicleInfo
                },
                assignedDate: delivery.assignedDate
            }
        });

    } catch (error) {
        logger.error('Error assigning driver to delivery:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign driver to delivery',
            error: error.message
        });
    }
});

/**
 * GET /api/delivery-management/drivers
 * Get available drivers (Admin/Warehouse/Cashier only)
 */
router.get('/drivers', authenticateToken, authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { available, search, sortBy = 'fullName', sortOrder = 'asc' } = req.query;

        let query = { role: 'driver' };

        if (available === 'true') {
            query.status = 'active';
            query.isAvailable = true;
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { fullName: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { 'vehicleInfo.plateNumber': searchRegex }
            ];
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const drivers = await User.find(query)
            .select('-password')
            .sort(sortOptions);

        // Get delivery stats for each driver
        const driversWithStats = await Promise.all(
            drivers.map(async (driver) => {
                const [totalDeliveries, activeDeliveries, completedDeliveries] = await Promise.all([
                    Delivery.countDocuments({ assignedDriver: driver._id }),
                    Delivery.countDocuments({
                        assignedDriver: driver._id,
                        status: { $in: ['assigned', 'out_from_warehouse', 'on_the_way'] }
                    }),
                    Delivery.countDocuments({
                        assignedDriver: driver._id,
                        status: 'delivered'
                    })
                ]);

                return {
                    id: driver._id,
                    fullName: driver.fullName,
                    email: driver.email,
                    phone: driver.phone,
                    licenseNumber: driver.licenseNumber,
                    vehicleInfo: driver.vehicleInfo || {
                        type: 'Not specified',
                        plateNumber: 'Not provided',
                        capacity: 'Not specified'
                    },
                    status: driver.status || 'active',
                    isAvailable: driver.isAvailable !== false,
                    currentDeliveries: activeDeliveries,
                    maxDeliveries: driver.maxDeliveries || 5,
                    totalDeliveries,
                    successfulDeliveries: completedDeliveries,
                    rating: driver.rating || 4.5,
                    currentLocation: driver.currentLocation,
                    createdAt: driver.createdAt
                };
            })
        );

        res.json({
            success: true,
            drivers: driversWithStats
        });

    } catch (error) {
        logger.error('Error fetching drivers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch drivers',
            error: error.message
        });
    }
});

/**
 * GET /api/delivery-management/analytics
 * Get delivery analytics and stats (Admin/Warehouse/Cashier only)
 */
router.get('/analytics', authenticateToken, authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { startDate, endDate, warehouseId } = req.query;
        const { role, id: userId } = req.user;

        let matchQuery = {};

        // Apply date range
        if (startDate && endDate) {
            matchQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Role-based filtering
        if (role === 'warehouse') {
            const user = await User.findById(userId).select('warehouseId');
            if (user.warehouseId) {
                matchQuery.warehouseId = user.warehouseId;
            }
        } else if (warehouseId) {
            matchQuery.warehouseId = warehouseId;
        }

        // Get delivery statistics
        const [
            statusStats,
            priorityStats,
            dailyStats,
            driverPerformance,
            totalDeliveries,
            avgDeliveryTime
        ] = await Promise.all([
            // Status distribution
            Delivery.aggregate([
                { $match: matchQuery },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),

            // Priority distribution
            Delivery.aggregate([
                { $match: matchQuery },
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]),

            // Daily delivery trends
            Delivery.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveryDate' } },
                        count: { $sum: 1 },
                        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Driver performance
            Delivery.aggregate([
                { $match: { ...matchQuery, assignedDriver: { $exists: true } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'assignedDriver',
                        foreignField: '_id',
                        as: 'driver'
                    }
                },
                { $unwind: '$driver' },
                {
                    $group: {
                        _id: '$assignedDriver',
                        driverName: { $first: '$driver.fullName' },
                        totalDeliveries: { $sum: 1 },
                        successfulDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                        failedDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
                    }
                },
                {
                    $addFields: {
                        successRate: {
                            $multiply: [
                                { $divide: ['$successfulDeliveries', '$totalDeliveries'] },
                                100
                            ]
                        }
                    }
                },
                { $sort: { successRate: -1 } }
            ]),

            // Total deliveries count
            Delivery.countDocuments(matchQuery),

            // Average delivery time
            Delivery.aggregate([
                {
                    $match: {
                        ...matchQuery,
                        status: 'delivered',
                        actualDeliveryTime: { $exists: true },
                        createdAt: { $exists: true }
                    }
                },
                {
                    $addFields: {
                        deliveryTimeHours: {
                            $divide: [
                                { $subtract: ['$actualDeliveryTime', '$createdAt'] },
                                1000 * 60 * 60
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgDeliveryTime: { $avg: '$deliveryTimeHours' }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            analytics: {
                summary: {
                    totalDeliveries,
                    averageDeliveryTime: avgDeliveryTime[0]?.avgDeliveryTime || 0,
                    completionRate: statusStats.find(s => s._id === 'delivered')?.count || 0 / totalDeliveries * 100
                },
                statusDistribution: statusStats,
                priorityDistribution: priorityStats,
                dailyTrends: dailyStats,
                driverPerformance: driverPerformance.slice(0, 10), // Top 10 drivers
                generatedAt: new Date(),
                dateRange: {
                    start: startDate || null,
                    end: endDate || null
                }
            }
        });

    } catch (error) {
        logger.error('Error generating delivery analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate delivery analytics',
            error: error.message
        });
    }
});

/**
 * POST /api/delivery-management/deliveries
 * Create new delivery (Admin/Warehouse/Cashier only)
 */
router.post('/deliveries', authenticateToken, authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const {
            orderId,
            warehouseId,
            warehouseName,
            items,
            deliveryDate,
            timeSlot,
            priority,
            deliveryAddress,
            customerName,
            customerEmail,
            contactNumber,
            alternateContact,
            specialInstructions
        } = req.body;

        const { id: userId } = req.user;

        // Validate required fields
        if (!orderId || !warehouseId || !items || !deliveryDate || !timeSlot || !deliveryAddress || !customerName || !customerEmail || !contactNumber) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create delivery
        const delivery = new Delivery({
            orderId,
            warehouseId,
            warehouseName,
            items,
            deliveryDate: new Date(deliveryDate),
            timeSlot,
            priority: priority || 'normal',
            deliveryAddress,
            customerName,
            customerEmail,
            contactNumber,
            alternateContact,
            specialInstructions,
            status: 'scheduled',
            createdBy: userId,
            updatedBy: userId
        });

        await delivery.save();

        res.status(201).json({
            success: true,
            message: 'Delivery created successfully',
            delivery: {
                id: delivery._id,
                trackingNumber: delivery.trackingNumber,
                status: delivery.status,
                deliveryDate: delivery.deliveryDate,
                timeSlot: delivery.timeSlot,
                customerName: delivery.customerName,
                createdAt: delivery.createdAt
            }
        });

    } catch (error) {
        logger.error('Error creating delivery:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create delivery',
            error: error.message
        });
    }
});

export default router;
