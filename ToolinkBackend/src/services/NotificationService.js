import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import EmailService from './EmailService.js';
import logger from '../utils/logger.js';

class NotificationService {
    /**
     * Smart notification system with multi-channel delivery
     */
    static async sendSmartNotification(notificationData, options = {}) {
        try {
            const {
                channels = ['in-app'], // ['in-app', 'email', 'sms', 'whatsapp']
                userPreferences = true,
                batchDelay = 0,
                language = 'en'
            } = options;

            // Get recipients
            const recipients = await this.getNotificationRecipients(notificationData);
            const results = [];

            for (const recipient of recipients) {
                try {
                    // Check user preferences if enabled
                    const enabledChannels = userPreferences ?
                        await this.getUserNotificationPreferences(recipient._id, channels) :
                        channels;

                    const notificationResult = {
                        userId: recipient._id,
                        userEmail: recipient.email,
                        channels: {},
                        success: true,
                        errors: []
                    };

                    // Send through each enabled channel
                    for (const channel of enabledChannels) {
                        try {
                            await this.sendThroughChannel(
                                channel,
                                recipient,
                                notificationData,
                                language
                            );
                            notificationResult.channels[channel] = 'sent';
                        } catch (error) {
                            notificationResult.channels[channel] = 'failed';
                            notificationResult.errors.push(`${channel}: ${error.message}`);
                            notificationResult.success = false;
                        }
                    }

                    results.push(notificationResult);

                    // Batch delay to prevent overwhelming
                    if (batchDelay > 0) {
                        await this.delay(batchDelay);
                    }

                } catch (error) {
                    logger.error(`Failed to send notification to user ${recipient._id}:`, error);
                    results.push({
                        userId: recipient._id,
                        success: false,
                        errors: [error.message]
                    });
                }
            }

            logger.info(`Smart notification sent to ${recipients.length} recipients`);
            return {
                success: true,
                recipientCount: recipients.length,
                results
            };

        } catch (error) {
            logger.error('Smart notification failed:', error);
            throw error;
        }
    }

    /**
     * Send notification through specific channel
     */
    static async sendThroughChannel(channel, recipient, notificationData, language) {
        switch (channel) {
            case 'in-app':
                return await this.sendInAppNotification(recipient, notificationData);

            case 'email':
                return await this.sendEmailNotification(recipient, notificationData, language);

            case 'sms':
                return await this.sendSMSNotification(recipient, notificationData, language);

            case 'whatsapp':
                return await this.sendWhatsAppNotification(recipient, notificationData, language);

            default:
                throw new Error(`Unsupported notification channel: ${channel}`);
        }
    }

    /**
     * Send in-app notification
     */
    static async sendInAppNotification(recipient, notificationData) {
        try {
            const notification = new Notification({
                userId: recipient._id,
                title: notificationData.title,
                message: notificationData.message,
                category: notificationData.category || 'general',
                type: notificationData.type || 'info',
                priority: notificationData.priority || 'medium',
                data: notificationData.data || {},
                isRead: false,
                sender: notificationData.sender || { system: true, name: 'ToolLink System' }
            });

            await notification.save();

            // Emit real-time notification if WebSocket available
            this.emitRealTimeNotification(recipient._id, notification);

            logger.info(`In-app notification sent to user ${recipient._id}`);
            return notification;

        } catch (error) {
            logger.error('In-app notification failed:', error);
            throw error;
        }
    }

    /**
     * Send email notification
     */
    static async sendEmailNotification(recipient, notificationData, language) {
        try {
            if (!recipient.email) {
                throw new Error('User email not available');
            }

            // Choose appropriate email template based on notification type
            const templateMap = {
                'order-created': 'order-notification',
                'order-updated': 'order-notification',
                'delivery-update': 'delivery-notification',
                'low-stock': 'low-stock-alert',
                'out-of-stock': 'out-of-stock-alert',
                'system-alert': 'system-notification'
            };

            const template = templateMap[notificationData.type] || 'general-notification';

            const emailData = {
                recipientName: recipient.fullName || recipient.username,
                title: notificationData.title,
                message: notificationData.message,
                data: notificationData.data || {},
                actionUrl: notificationData.actionUrl || `${process.env.FRONTEND_URL}/notifications`,
                supportEmail: process.env.SUPPORT_EMAIL || 'support@toollink.lk',
                unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe/${recipient._id}`
            };

            await EmailService.sendTemplatedEmail(
                recipient.email,
                template,
                emailData,
                language,
                notificationData.title
            );

            logger.info(`Email notification sent to ${recipient.email}`);

        } catch (error) {
            logger.error('Email notification failed:', error);
            throw error;
        }
    }

    /**
     * Send SMS notification
     */
    static async sendSMSNotification(recipient, notificationData, language) {
        try {
            if (!recipient.phone) {
                throw new Error('User phone number not available');
            }

            // Format message for SMS (160 character limit)
            const smsMessage = this.formatSMSMessage(notificationData, language);

            await EmailService.sendSMS(recipient.phone, smsMessage, notificationData.type);

            logger.info(`SMS notification sent to ${recipient.phone}`);

        } catch (error) {
            logger.error('SMS notification failed:', error);
            throw error;
        }
    }

    /**
     * Send WhatsApp notification
     */
    static async sendWhatsAppNotification(recipient, notificationData, language) {
        try {
            if (!recipient.phone) {
                throw new Error('User phone number not available');
            }

            // Format message for WhatsApp
            const whatsappMessage = this.formatWhatsAppMessage(notificationData, language);

            await EmailService.sendWhatsAppMessage(
                recipient.phone,
                whatsappMessage,
                notificationData.whatsappTemplate
            );

            logger.info(`WhatsApp notification sent to ${recipient.phone}`);

        } catch (error) {
            logger.error('WhatsApp notification failed:', error);
            throw error;
        }
    }

    /**
     * Get notification recipients based on criteria
     */
    static async getNotificationRecipients(notificationData) {
        try {
            let filter = { isActive: true };

            // Handle different recipient types
            if (notificationData.recipients) {
                if (notificationData.recipients.specific) {
                    // Specific user IDs
                    filter._id = { $in: notificationData.recipients.userIds };
                } else if (notificationData.recipients.roles) {
                    // By user roles
                    filter.role = { $in: notificationData.recipients.roles };
                } else if (notificationData.recipients.all) {
                    // All active users
                    filter = { isActive: true };
                }
            } else {
                // Default: admin and manager users
                filter.role = { $in: ['admin', 'manager'] };
            }

            // Add location filter if specified
            if (notificationData.recipients?.location) {
                filter['address.city'] = notificationData.recipients.location;
            }

            const recipients = await User.find(filter)
                .select('_id fullName username email phone role notificationPreferences');

            return recipients;

        } catch (error) {
            logger.error('Getting notification recipients failed:', error);
            return [];
        }
    }

    /**
     * Get user notification preferences
     */
    static async getUserNotificationPreferences(userId, requestedChannels) {
        try {
            const user = await User.findById(userId).select('notificationPreferences');

            if (!user || !user.notificationPreferences) {
                // Return all requested channels if no preferences set
                return requestedChannels;
            }

            const prefs = user.notificationPreferences;
            const enabledChannels = [];

            for (const channel of requestedChannels) {
                const prefKey = `${channel}Notifications`;
                if (prefs[prefKey] !== false) { // Enabled by default unless explicitly disabled
                    enabledChannels.push(channel);
                }
            }

            return enabledChannels;

        } catch (error) {
            logger.error('Getting user notification preferences failed:', error);
            return requestedChannels; // Fallback to all requested channels
        }
    }

    /**
     * Bulk notification for system-wide alerts
     */
    static async sendBulkNotification(notificationData, options = {}) {
        try {
            const {
                batchSize = 50,
                batchDelay = 1000, // 1 second between batches
                channels = ['in-app', 'email']
            } = options;

            const recipients = await this.getNotificationRecipients(notificationData);
            const totalRecipients = recipients.length;
            const batches = [];

            // Split recipients into batches
            for (let i = 0; i < totalRecipients; i += batchSize) {
                batches.push(recipients.slice(i, i + batchSize));
            }

            let successCount = 0;
            let failureCount = 0;
            const results = [];

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];

                logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} recipients)`);

                const batchPromises = batch.map(recipient =>
                    this.sendSmartNotification(
                        { ...notificationData, recipients: { specific: true, userIds: [recipient._id] } },
                        { channels, userPreferences: true }
                    ).catch(error => {
                        logger.error(`Batch notification failed for user ${recipient._id}:`, error);
                        return { success: false, error: error.message };
                    })
                );

                const batchResults = await Promise.allSettled(batchPromises);

                batchResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.success) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                    results.push(result);
                });

                // Delay between batches
                if (i < batches.length - 1 && batchDelay > 0) {
                    await this.delay(batchDelay);
                }
            }

            logger.info(`Bulk notification completed: ${successCount} successful, ${failureCount} failed`);

            return {
                success: true,
                totalRecipients,
                successCount,
                failureCount,
                batches: batches.length,
                results
            };

        } catch (error) {
            logger.error('Bulk notification failed:', error);
            throw error;
        }
    }

    /**
     * Send order notifications
     */
    static async sendOrderNotification(orderId, action, additionalData = {}) {
        try {
            const Order = mongoose.model('Order');
            const order = await Order.findById(orderId)
                .populate('customer', 'fullName email phone')
                .populate('items.inventory', 'name');

            if (!order) {
                throw new Error('Order not found');
            }

            const customer = order.customer;
            const orderValue = order.finalAmount || 0;

            const notificationData = {
                title: `Order ${action.charAt(0).toUpperCase() + action.slice(1)} - ${order.orderNumber}`,
                message: `Order ${order.orderNumber} has been ${action}. Value: Rs. ${orderValue.toLocaleString()}`,
                category: 'order',
                type: `order-${action}`,
                priority: action === 'cancelled' ? 'high' : 'medium',
                data: {
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    customerName: customer?.fullName,
                    orderValue,
                    action,
                    ...additionalData
                },
                recipients: {
                    specific: true,
                    userIds: [customer?._id].filter(Boolean)
                },
                actionUrl: `${process.env.FRONTEND_URL}/orders/${order._id}`
            };

            // Also notify admin users for new orders
            if (action === 'created') {
                const adminNotification = {
                    ...notificationData,
                    title: `New Order Received - ${order.orderNumber}`,
                    message: `New order from ${customer?.fullName || 'Customer'} for Rs. ${orderValue.toLocaleString()}`,
                    recipients: {
                        roles: ['admin', 'warehouse', 'manager']
                    }
                };

                await this.sendSmartNotification(adminNotification, {
                    channels: ['in-app', 'email'],
                    language: 'en'
                });
            }

            return await this.sendSmartNotification(notificationData, {
                channels: ['in-app', 'email', 'sms'],
                language: customer?.preferredLanguage || 'en'
            });

        } catch (error) {
            logger.error('Order notification failed:', error);
            throw error;
        }
    }

    /**
     * Send delivery notifications
     */
    static async sendDeliveryNotification(deliveryId, status, additionalData = {}) {
        try {
            const Delivery = mongoose.model('Delivery');
            const delivery = await Delivery.findById(deliveryId)
                .populate('orderId', 'orderNumber customer')
                .populate('customerId', 'fullName email phone preferredLanguage')
                .populate('driverId', 'fullName phone');

            if (!delivery) {
                throw new Error('Delivery not found');
            }

            const customer = delivery.customerId || delivery.orderId?.customer;

            const statusMessages = {
                'pending': 'scheduled for delivery',
                'assigned': 'assigned to driver',
                'out_from_warehouse': 'dispatched from warehouse',
                'on_the_way': 'out for delivery',
                'delivered': 'successfully delivered',
                'failed': 'delivery attempt failed'
            };

            const notificationData = {
                title: `Delivery Update - ${delivery.trackingNumber || delivery._id}`,
                message: `Your delivery has been ${statusMessages[status] || status}`,
                category: 'delivery',
                type: 'delivery-update',
                priority: status === 'failed' ? 'high' : 'medium',
                data: {
                    deliveryId: delivery._id,
                    orderId: delivery.orderId?._id,
                    orderNumber: delivery.orderId?.orderNumber,
                    status,
                    trackingNumber: delivery.trackingNumber,
                    driverName: delivery.driverId?.fullName,
                    driverPhone: delivery.driverId?.phone,
                    ...additionalData
                },
                recipients: {
                    specific: true,
                    userIds: [customer?._id].filter(Boolean)
                },
                actionUrl: `${process.env.FRONTEND_URL}/deliveries/${delivery._id}`
            };

            const channels = ['in-app', 'email'];

            // Add SMS for critical delivery updates
            if (['out_from_warehouse', 'delivered', 'failed'].includes(status)) {
                channels.push('sms');
            }

            return await this.sendSmartNotification(notificationData, {
                channels,
                language: customer?.preferredLanguage || 'en'
            });

        } catch (error) {
            logger.error('Delivery notification failed:', error);
            throw error;
        }
    }

    /**
     * Send inventory alerts
     */
    static async sendInventoryAlert(inventoryId, alertType, additionalData = {}) {
        try {
            const Inventory = mongoose.model('Inventory');
            const inventory = await Inventory.findById(inventoryId);

            if (!inventory) {
                throw new Error('Inventory item not found');
            }

            const alertMessages = {
                'low-stock': `Low stock alert: ${inventory.name} (${inventory.current_stock} ${inventory.unit} remaining)`,
                'out-of-stock': `OUT OF STOCK: ${inventory.name} requires immediate attention`,
                'restock-suggestion': `Restock suggestion: Consider reordering ${inventory.name}`
            };

            const notificationData = {
                title: alertType === 'out-of-stock' ? '🚨 OUT OF STOCK ALERT' : '⚠️ INVENTORY ALERT',
                message: alertMessages[alertType] || `Inventory alert for ${inventory.name}`,
                category: 'inventory',
                type: alertType,
                priority: alertType === 'out-of-stock' ? 'critical' : 'high',
                data: {
                    inventoryId: inventory._id,
                    itemName: inventory.name,
                    sku: inventory.sku,
                    currentStock: inventory.current_stock,
                    minLevel: inventory.min_stock_level,
                    unit: inventory.unit,
                    category: inventory.category,
                    ...additionalData
                },
                recipients: {
                    roles: ['admin', 'warehouse', 'manager']
                },
                actionUrl: `${process.env.FRONTEND_URL}/inventory/${inventory._id}`
            };

            const channels = ['in-app', 'email'];

            // Add SMS for critical out-of-stock alerts
            if (alertType === 'out-of-stock') {
                channels.push('sms');
            }

            return await this.sendSmartNotification(notificationData, {
                channels,
                language: 'en'
            });

        } catch (error) {
            logger.error('Inventory alert failed:', error);
            throw error;
        }
    }

    /**
     * Format SMS message (160 character limit)
     */
    static formatSMSMessage(notificationData, language = 'en') {
        const baseMessage = `${notificationData.title}: ${notificationData.message}`;

        if (baseMessage.length <= 160) {
            return baseMessage;
        }

        // Truncate and add company signature
        const truncated = baseMessage.substring(0, 140) + '...';
        return `${truncated} -ToolLink`;
    }

    /**
     * Format WhatsApp message
     */
    static formatWhatsAppMessage(notificationData, language = 'en') {
        let message = `*${notificationData.title}*\n\n`;
        message += `${notificationData.message}\n\n`;

        if (notificationData.data) {
            if (notificationData.data.orderNumber) {
                message += `Order: ${notificationData.data.orderNumber}\n`;
            }
            if (notificationData.data.trackingNumber) {
                message += `Tracking: ${notificationData.data.trackingNumber}\n`;
            }
        }

        message += '\n---\n';
        message += 'ToolLink Sri Lanka\n';
        message += 'Your Construction Materials Partner';

        return message;
    }

    /**
     * Emit real-time notification via WebSocket
     */
    static emitRealTimeNotification(userId, notification) {
        try {
            // This would integrate with Socket.IO or similar WebSocket implementation
            // For now, we'll log it
            logger.info(`Real-time notification emitted to user ${userId}: ${notification.title}`);

            // In actual implementation:
            // if (global.io) {
            //     global.io.to(`user_${userId}`).emit('notification', notification);
            // }

        } catch (error) {
            logger.error('Real-time notification emission failed:', error);
        }
    }

    /**
     * Update notification preferences
     */
    static async updateNotificationPreferences(userId, preferences) {
        try {
            await User.findByIdAndUpdate(userId, {
                'notificationPreferences': preferences
            });

            logger.info(`Notification preferences updated for user ${userId}`);

        } catch (error) {
            logger.error('Updating notification preferences failed:', error);
            throw error;
        }
    }

    /**
     * Get notification statistics
     */
    static async getNotificationStatistics(timeRange = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - timeRange);

            const stats = await Notification.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        read: { $sum: { $cond: ['$isRead', 1, 0] } },
                        unread: { $sum: { $cond: ['$isRead', 0, 1] } },
                        byCategory: {
                            $push: {
                                category: '$category',
                                priority: '$priority'
                            }
                        }
                    }
                }
            ]);

            const categoryStats = await Notification.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        readCount: { $sum: { $cond: ['$isRead', 1, 0] } }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            const result = stats[0] || { total: 0, read: 0, unread: 0 };
            result.categoryBreakdown = categoryStats;
            result.readRate = result.total > 0 ? Math.round((result.read / result.total) * 100) : 0;

            return result;

        } catch (error) {
            logger.error('Notification statistics failed:', error);
            return {};
        }
    }

    /**
     * Mark notifications as read
     */
    static async markAsRead(userId, notificationIds = null) {
        try {
            const filter = { userId, isRead: false };

            if (notificationIds) {
                filter._id = { $in: notificationIds };
            }

            const result = await Notification.updateMany(filter, {
                isRead: true,
                readAt: new Date()
            });

            logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
            return result;

        } catch (error) {
            logger.error('Marking notifications as read failed:', error);
            throw error;
        }
    }

    /**
     * Cleanup old notifications
     */
    static async cleanupOldNotifications(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const result = await Notification.deleteMany({
                createdAt: { $lt: cutoffDate },
                isRead: true
            });

            logger.info(`Cleaned up ${result.deletedCount} old notifications`);
            return result;

        } catch (error) {
            logger.error('Notification cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Simple create notification method
     */
    static async create(toRole, toUserId, type, message, meta = {}) {
        try {
            const notification = new Notification({
                toRole,
                toUserId,
                type,
                message,
                meta,
                read: false,
                createdAt: new Date()
            });

            await notification.save();
            logger.info(`Notification created: ${type} for ${toRole || toUserId}`);

            return notification;
        } catch (error) {
            logger.error('Create notification failed:', error);
            throw error;
        }
    }

    /**
     * Utility function for delays
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default NotificationService;
