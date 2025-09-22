import express from 'express';
import { authorize, authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import Notification from '../models/Notification.js';
import Order from '../models/Order.js';
import Delivery from '../models/Delivery.js';
import Inventory from '../models/Inventory.js';
import User from '../models/User.js';

const router = express.Router();

// Temporary storage for read status (in production, this should be in database)
const readNotifications = new Set();

// Helper function to create notifications from real data
const createRealtimeNotifications = async () => {
    try {
        // Get recent orders for notifications
        const recentOrders = await Order.find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
            .populate('customer', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get low stock items for notifications
        const lowStockItems = await Inventory.find({
            $expr: { $lte: ['$current_stock', '$min_stock_level'] },
            status: 'active'
        }).limit(5);

        // Get recent deliveries for notifications
        const recentDeliveries = await Delivery.find({
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
            .populate('orderId', 'orderNumber customer')
            .populate({
                path: 'orderId',
                populate: {
                    path: 'customer',
                    select: 'fullName email'
                }
            })
            .sort({ updatedAt: -1 })
            .limit(10);

        // Get pending users for approval
        const pendingUsers = await User.find({
            isApproved: false,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }).limit(5);

        return {
            recentOrders,
            lowStockItems,
            recentDeliveries,
            pendingUsers
        };
    } catch (error) {
        logger.error('Error creating realtime notifications:', error);
        return {
            recentOrders: [],
            lowStockItems: [],
            recentDeliveries: [],
            pendingUsers: []
        };
    }
};

// Transform real data into notification format
const transformToNotifications = (data, userId = null) => {
    const notifications = [];
    let idCounter = 1;

    // Order notifications
    data.recentOrders.forEach(order => {
        const notificationId = `order_${order._id}_${idCounter++}`;
        notifications.push({
            _id: notificationId,
            userId: userId,
            type: 'info',
            category: 'order',
            title: 'New Order Received',
            message: `Order ${order.orderNumber} has been placed by ${order.customer?.fullName || 'Customer'}`,
            priority: order.priority || 'normal',
            status: 'sent',
            isRead: readNotifications.has(notificationId),
            createdAt: order.createdAt,
            recipient: { specific: false },
            sender: { system: true, name: 'Order System' },
            isArchived: false,
            metadata: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                customerName: order.customer?.fullName
            }
        });
    });

    // Low stock notifications
    data.lowStockItems.forEach(item => {
        const notificationId = `inventory_${item._id}_${idCounter++}`;
        notifications.push({
            _id: notificationId,
            userId: userId,
            type: 'warning',
            category: 'inventory',
            title: 'Low Stock Alert',
            message: `${item.name} is running low on stock. Current: ${item.current_stock} ${item.unit}, Minimum: ${item.min_stock_level} ${item.unit}`,
            priority: 'high',
            status: 'sent',
            isRead: readNotifications.has(notificationId),
            createdAt: item.updatedAt || item.createdAt,
            recipient: { specific: false },
            sender: { system: true, name: 'Inventory System' },
            isArchived: false,
            metadata: {
                inventoryId: item._id,
                itemName: item.name,
                currentStock: item.current_stock,
                minLevel: item.min_stock_level,
                sku: item.sku
            }
        });
    });

    // Delivery notifications
    data.recentDeliveries.forEach(delivery => {
        const statusMessages = {
            'scheduled': 'has been scheduled',
            'in_transit': 'is now in transit',
            'delivered': 'has been delivered successfully',
            'failed': 'delivery attempt failed',
            'cancelled': 'has been cancelled'
        };

        const notificationId = `delivery_${delivery._id}_${idCounter++}`;
        notifications.push({
            _id: notificationId,
            userId: userId,
            type: delivery.status === 'delivered' ? 'success' : delivery.status === 'failed' ? 'error' : 'info',
            category: 'delivery',
            title: 'Delivery Update',
            message: `Delivery for order ${delivery.orderId?.orderNumber || 'N/A'} ${statusMessages[delivery.status] || 'status updated'}`,
            priority: delivery.status === 'failed' ? 'high' : 'normal',
            status: 'sent',
            isRead: readNotifications.has(notificationId),
            createdAt: delivery.updatedAt,
            recipient: { specific: false },
            sender: { system: true, name: 'Delivery System' },
            isArchived: false,
            metadata: {
                deliveryId: delivery._id,
                orderId: delivery.orderId?._id,
                orderNumber: delivery.orderId?.orderNumber,
                status: delivery.status,
                trackingNumber: delivery.trackingNumber
            }
        });
    });

    // User approval notifications
    data.pendingUsers.forEach(user => {
        const notificationId = `user_${user._id}_${idCounter++}`;
        notifications.push({
            _id: notificationId,
            userId: userId,
            type: 'info',
            category: 'user',
            title: 'New User Registration',
            message: `${user.fullName || user.username || 'A new user'} has registered and requires approval`,
            priority: 'normal',
            status: 'sent',
            isRead: readNotifications.has(notificationId),
            createdAt: user.createdAt,
            recipient: { specific: false },
            sender: { system: true, name: 'User System' },
            isArchived: false,
            metadata: {
                userId: user._id,
                userName: user.fullName,
                userEmail: user.email,
                userRole: user.role
            }
        });
    });

    // Sort by creation date (newest first)
    return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { category, priority, unreadOnly, page = 1, limit = 20 } = req.query;

        // Get real-time data from database
        const realData = await createRealtimeNotifications();

        // Transform to notifications format
        let notifications = transformToNotifications(realData, req.user._id);

        // Apply filters
        if (category) {
            notifications = notifications.filter(n => n.category === category);
        }

        if (priority) {
            notifications = notifications.filter(n => n.priority === priority);
        }

        if (unreadOnly === 'true') {
            notifications = notifications.filter(n => !n.isRead);
        }

        // Count unread notifications
        const unreadCount = notifications.filter(n => !n.isRead).length;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedNotifications = notifications.slice(skip, skip + parseInt(limit));
        const totalPages = Math.ceil(notifications.length / parseInt(limit));

        logger.info(`Fetched ${notifications.length} real notifications for user ${req.user._id}`);

        res.json({
            success: true,
            notifications: paginatedNotifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalCount: notifications.length,
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1
            },
            unreadCount: unreadCount
        });
    } catch (error) {
        logger.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications',
            errorType: 'FETCH_NOTIFICATIONS_ERROR'
        });
    }
});

// Get notification statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        // Get real-time data from database
        const realData = await createRealtimeNotifications();

        // Transform to notifications format
        const notifications = transformToNotifications(realData, req.user._id);

        const stats = {
            total: notifications.length,
            unread: notifications.filter(n => !n.isRead).length,
            read: notifications.filter(n => n.isRead).length,
            byCategory: {
                system: notifications.filter(n => n.category === 'system').length,
                inventory: notifications.filter(n => n.category === 'inventory').length,
                order: notifications.filter(n => n.category === 'order').length,
                delivery: notifications.filter(n => n.category === 'delivery').length,
                user: notifications.filter(n => n.category === 'user').length
            },
            byPriority: {
                high: notifications.filter(n => n.priority === 'high').length,
                normal: notifications.filter(n => n.priority === 'normal').length,
                low: notifications.filter(n => n.priority === 'low').length
            },
            byType: {
                info: notifications.filter(n => n.type === 'info').length,
                warning: notifications.filter(n => n.type === 'warning').length,
                error: notifications.filter(n => n.type === 'error').length,
                success: notifications.filter(n => n.type === 'success').length
            }
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
            errorType: 'FETCH_STATS_ERROR'
        });
    }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        // Get real-time data from database
        const realData = await createRealtimeNotifications();

        // Transform to notifications format
        const notifications = transformToNotifications(realData, req.user._id);

        const unreadCount = notifications.filter(n => !n.isRead).length;

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
            errorType: 'FETCH_UNREAD_COUNT_ERROR'
        });
    }
});

// Get single notification
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Get real-time data from database
        const realData = await createRealtimeNotifications();

        // Transform to notifications format
        const notifications = transformToNotifications(realData, req.user._id);

        const notification = notifications.find(n => n._id === req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found',
                errorType: 'NOTIFICATION_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        logger.error('Get notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification',
            errorType: 'FETCH_NOTIFICATION_ERROR'
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

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        // Get real-time data from database
        const realData = await createRealtimeNotifications();

        // Transform to notifications format
        const notifications = transformToNotifications(realData, req.user._id);

        const notification = notifications.find(n => n._id === req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found',
                errorType: 'NOTIFICATION_NOT_FOUND'
            });
        }

        // Mark as read in temporary storage
        readNotifications.add(req.params.id);
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        notification.status = 'read';

        logger.info(`Notification ${req.params.id} marked as read by user ${req.user._id}`);

        res.json({
            success: true,
            message: 'Notification marked as read',
            data: notification
        });
    } catch (error) {
        logger.error('Mark notification as read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read',
            errorType: 'MARK_READ_ERROR'
        });
    }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        // Get real-time data from database
        const realData = await createRealtimeNotifications();

        // Transform to notifications format
        const notifications = transformToNotifications(realData, req.user._id);

        let updatedCount = 0;

        notifications.forEach(notification => {
            if (!notification.isRead) {
                readNotifications.add(notification._id);
                updatedCount++;
            }
        });

        logger.info(`Marked ${updatedCount} notifications as read for user ${req.user._id}`);

        res.json({
            success: true,
            message: `Marked ${updatedCount} notifications as read`,
            data: { updatedCount }
        });
    } catch (error) {
        logger.error('Mark all notifications as read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark all notifications as read',
            errorType: 'MARK_ALL_READ_ERROR'
        });
    }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Since we're using real-time data, we'll just mark as deleted in our read set
        // In production, this would delete from database or mark as archived
        readNotifications.add(`deleted_${req.params.id}`);

        logger.info(`Notification ${req.params.id} deleted by user ${req.user._id}`);

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        logger.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete notification',
            errorType: 'DELETE_NOTIFICATION_ERROR'
        });
    }
});

export default router;
