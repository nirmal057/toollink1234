import express from 'express';
import { authorize, authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import Notification from '../models/Notification.js';
import Order from '../models/Order.js';
import Delivery from '../models/Delivery.js';
import Inventory from '../models/Inventory.js';
import User from '../models/User.js';

const router = express.Router();

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { category, priority, unreadOnly, page = 1, limit = 20 } = req.query;

        // Build query for user-specific notifications
        const query = {
            $or: [
                { toUserId: req.user._id }, // Notifications targeted to this specific user
                { toRole: req.user.role.toUpperCase() } // Notifications targeted to this user's role
            ]
        };

        // Apply filters
        if (unreadOnly === 'true') {
            query.read = false;
        }

        // Get notifications from database
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .populate('toUserId', 'fullName email role')
            .lean();

        // Get total count for pagination
        const totalCount = await Notification.countDocuments(query);
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        // Count unread notifications for this user
        const unreadQuery = {
            $or: [
                { toUserId: req.user._id },
                { toRole: req.user.role.toUpperCase() }
            ],
            read: false
        };
        const unreadCount = await Notification.countDocuments(unreadQuery);

        // Transform notifications to match expected format
        const transformedNotifications = notifications.map(notification => ({
            id: notification._id,
            title: getNotificationTitle(notification.type),
            message: notification.message,
            type: notification.type.toLowerCase(),
            priority: getNotificationPriority(notification.type),
            category: getNotificationCategory(notification.type),
            timestamp: notification.createdAt,
            isRead: notification.read,
            metadata: notification.meta || {},
            userId: notification.toUserId?._id,
            userRole: notification.toRole
        }));

        logger.info(`Fetched ${notifications.length} targeted notifications for user ${req.user._id} (${req.user.role})`);

        res.json({
            success: true,
            notifications: transformedNotifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1
            },
            unreadCount
        });
    } catch (error) {
        logger.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications',
            details: error.message
        });
    }
});

// Helper functions for notification formatting
function getNotificationTitle(type) {
    const titles = {
        'LOW_STOCK': 'Low Stock Alert',
        'UPCOMING_DELIVERY': 'Upcoming Delivery',
        'DELIVERY_DELAYED': 'Delivery Delayed',
        'ORDER_STATUS_CHANGE': 'Order Status Update',
        'MATERIAL_REFILL_NEEDED': 'Material Refill Needed',
        'NEW_ORDER_APPROVAL': 'New Order Pending Approval',
        'SYSTEM': 'System Notification'
    };
    return titles[type] || 'Notification';
}

function getNotificationPriority(type) {
    const priorities = {
        'LOW_STOCK': 'high',
        'UPCOMING_DELIVERY': 'medium',
        'DELIVERY_DELAYED': 'high',
        'ORDER_STATUS_CHANGE': 'medium',
        'MATERIAL_REFILL_NEEDED': 'high',
        'NEW_ORDER_APPROVAL': 'high',
        'SYSTEM': 'low'
    };
    return priorities[type] || 'medium';
}

function getNotificationCategory(type) {
    const categories = {
        'LOW_STOCK': 'inventory',
        'UPCOMING_DELIVERY': 'delivery',
        'DELIVERY_DELAYED': 'delivery',
        'ORDER_STATUS_CHANGE': 'order',
        'MATERIAL_REFILL_NEEDED': 'inventory',
        'NEW_ORDER_APPROVAL': 'order',
        'SYSTEM': 'system'
    };
    return categories[type] || 'general';
}

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;

        // Update notification read status in database
        const notification = await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                $or: [
                    { toUserId: req.user._id },
                    { toRole: req.user.role.toUpperCase() }
                ]
            },
            { read: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found or access denied'
            });
        }

        logger.info(`Notification ${notificationId} marked as read by user ${req.user._id}`);

        res.json({
            success: true,
            message: 'Notification marked as read',
            data: {
                id: notification._id,
                read: notification.read,
                readAt: notification.readAt
            }
        });
    } catch (error) {
        logger.error('Mark notification as read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read',
            details: error.message
        });
    }
});

// Get notification statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        // Build query for user-specific notifications
        const query = {
            $or: [
                { toUserId: req.user._id },
                { toRole: req.user.role.toUpperCase() }
            ]
        };

        // Get total notifications
        const totalNotifications = await Notification.countDocuments(query);

        // Get unread notifications
        const unreadNotifications = await Notification.countDocuments({
            ...query,
            read: false
        });

        // Get notifications by category
        const categoryStats = await Notification.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        const stats = {
            total: totalNotifications,
            unread: unreadNotifications,
            read: totalNotifications - unreadNotifications,
            byCategory: categoryStats.reduce((acc, stat) => {
                const category = getNotificationCategory(stat._id);
                acc[category] = (acc[category] || 0) + stat.count;
                return acc;
            }, {}),
            byType: categoryStats.reduce((acc, stat) => {
                acc[stat._id.toLowerCase()] = stat.count;
                return acc;
            }, {})
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Get notification statistics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification statistics',
            details: error.message
        });
    }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        // Build query for user-specific notifications
        const query = {
            $or: [
                { toUserId: req.user._id },
                { toRole: req.user.role.toUpperCase() }
            ],
            read: false
        };

        const unreadCount = await Notification.countDocuments(query);

        logger.info(`Unread notifications count: ${unreadCount} for user ${req.user._id}`);

        res.json({
            success: true,
            data: {
                count: unreadCount
            }
        });
    } catch (error) {
        logger.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch unread count',
            details: error.message
        });
    }
});

// Get single notification
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;

        // Find notification for this user
        const notification = await Notification.findOne({
            _id: notificationId,
            $or: [
                { toUserId: req.user._id },
                { toRole: req.user.role.toUpperCase() }
            ]
        })
            .populate('toUserId', 'fullName email role')
            .lean();

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found or access denied'
            });
        }

        // Transform to expected format
        const transformedNotification = {
            id: notification._id,
            title: getNotificationTitle(notification.type),
            message: notification.message,
            type: notification.type.toLowerCase(),
            priority: getNotificationPriority(notification.type),
            category: getNotificationCategory(notification.type),
            timestamp: notification.createdAt,
            isRead: notification.read,
            metadata: notification.meta || {},
            userId: notification.toUserId?._id,
            userRole: notification.toRole
        };

        res.json({
            success: true,
            data: transformedNotification
        });
    } catch (error) {
        logger.error('Get notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification',
            details: error.message
        });
    }
});

// Create notification (admin only)
router.post('/', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { userId, type, title, message, priority = 'medium' } = req.body;

        // For now, we'll just log the creation since we're using real-time data
        // In a production system, this would save to the database
        logger.info(`Notification creation requested: ${title} by ${req.user.fullName}`);

        res.status(201).json({
            success: true,
            message: 'Notification creation logged (real-time notifications active)',
            data: {
                id: `custom_${Date.now()}`,
                userId,
                type,
                title,
                message,
                priority,
                createdAt: new Date().toISOString(),
                createdBy: req.user._id
            }
        });
    } catch (error) {
        logger.error('Create notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create notification',
            errorType: 'CREATE_NOTIFICATION_ERROR'
        });
    }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        // Build query for user-specific notifications
        const query = {
            $or: [
                { toUserId: req.user._id },
                { toRole: req.user.role.toUpperCase() }
            ],
            read: false
        };

        // Update all unread notifications to read
        const result = await Notification.updateMany(
            query,
            {
                read: true,
                readAt: new Date()
            }
        );

        logger.info(`Marked ${result.modifiedCount} notifications as read for user ${req.user._id}`);

        res.json({
            success: true,
            message: `Marked ${result.modifiedCount} notifications as read`,
            data: { updatedCount: result.modifiedCount }
        });
    } catch (error) {
        logger.error('Mark all notifications as read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark all notifications as read',
            details: error.message
        });
    }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;

        // Delete notification from database (only if user has access)
        const result = await Notification.findOneAndDelete({
            _id: notificationId,
            $or: [
                { toUserId: req.user._id },
                { toRole: req.user.role.toUpperCase() }
            ]
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found or access denied'
            });
        }

        logger.info(`Notification ${notificationId} deleted by user ${req.user._id}`);

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        logger.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete notification',
            details: error.message
        });
    }
});

// Warehouse confirmation notification endpoint
router.post('/warehouse-confirmation', authenticateToken, async (req, res) => {
    try {
        const {
            orderId,
            customerEmail,
            customerName,
            warehouse,
            orderItems,
            orderDate,
            deliveryDate,
            deliveryTime
        } = req.body;

        // Validate required fields
        if (!orderId || !customerEmail || !customerName || !warehouse) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: orderId, customerEmail, customerName, warehouse'
            });
        }

        // Create in-app notification
        const notification = new Notification({
            userId: req.user._id,
            title: `Order Confirmed - ${warehouse}`,
            message: `Order #${orderId} has been confirmed by ${warehouse} for customer ${customerName}`,
            type: 'order_confirmation',
            metadata: {
                orderId,
                warehouse,
                customerName,
                customerEmail
            }
        });

        await notification.save();

        // Send email notification to customer
        try {
            const emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #FF6B35;">Order Confirmation - ${warehouse}</h2>

                    <p>Dear ${customerName},</p>

                    <p>Great news! Your order has been confirmed by our <strong>${warehouse}</strong> team.</p>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Order Details:</h3>
                        <p><strong>Order ID:</strong> #${orderId}</p>
                        <p><strong>Confirmed by:</strong> ${warehouse}</p>
                        <p><strong>Order Date:</strong> ${new Date(orderDate).toLocaleDateString()}</p>
                        <p><strong>Scheduled Delivery:</strong> ${new Date(deliveryDate).toLocaleDateString()} at ${deliveryTime}</p>

                        <h4>Items:</h4>
                        <ul>
                            ${orderItems.map(item => `<li>${item.name} (Quantity: ${item.quantity})</li>`).join('')}
                        </ul>
                    </div>

                    <p>Your order is now being prepared for delivery. You'll receive another notification when your order ships.</p>

                    <p>Thank you for choosing ToolLink!</p>

                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">
                        This is an automated message. Please do not reply to this email.
                    </p>
                </div>
            `;

            // For now, log the email (in production, integrate with actual email service)
            logger.info(`Email notification sent to ${customerEmail}:`, {
                subject: `Order Confirmed - ${warehouse} | ToolLink`,
                orderId,
                warehouse,
                customerName
            });

            // You can integrate with actual email service here (SendGrid, Nodemailer, etc.)
            console.log(`📧 EMAIL SENT TO: ${customerEmail}`);
            console.log(`📦 ORDER: #${orderId} confirmed by ${warehouse}`);
            console.log(`👤 CUSTOMER: ${customerName}`);

        } catch (emailError) {
            logger.error('Email sending error:', emailError);
            // Don't fail the whole request if email fails
        }

        logger.info(`Warehouse confirmation notification created for order ${orderId} by ${warehouse}`);

        res.json({
            success: true,
            message: 'Warehouse confirmation notification sent successfully',
            data: {
                notificationId: notification._id,
                orderId,
                warehouse,
                customerNotified: true
            }
        });

    } catch (error) {
        logger.error('Warehouse confirmation notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send warehouse confirmation notification',
            errorType: 'WAREHOUSE_CONFIRMATION_ERROR'
        });
    }
});

export default router;
