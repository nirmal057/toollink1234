import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Delivery from '../models/Delivery.js';
import Warehouse from '../models/Warehouse.js';
import Driver from '../models/Driver.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

class RoleBasedService {

    // ============================================================================
    // ADMIN FUNCTIONS - Full system access and management
    // ============================================================================

    static async getAdminDashboard(adminId) {
        try {
            const [
                totalUsers,
                totalOrders,
                totalInventory,
                totalWarehouses,
                totalDrivers,
                recentOrders,
                systemAlerts,
                monthlyRevenue
            ] = await Promise.all([
                User.countDocuments({ isActive: true }),
                Order.countDocuments(),
                Inventory.countDocuments(),
                Warehouse.countDocuments({ isActive: true }),
                Driver.countDocuments({ isActive: true }),
                Order.find().sort({ createdAt: -1 }).limit(10)
                    .populate('customer', 'fullName email')
                    .populate('items.inventory', 'name'),
                Notification.find({ type: 'system_alert', isRead: false })
                    .sort({ createdAt: -1 }),
                Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                            },
                            status: 'delivered'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: '$totalAmount' }
                        }
                    }
                ])
            ]);

            return {
                summary: {
                    totalUsers,
                    totalOrders,
                    totalInventory,
                    totalWarehouses,
                    totalDrivers,
                    monthlyRevenue: monthlyRevenue[0]?.totalRevenue || 0
                },
                recentActivity: {
                    orders: recentOrders,
                    alerts: systemAlerts
                }
            };
        } catch (error) {
            logger.error('Admin dashboard error:', error);
            throw error;
        }
    }

    static async manageUsers(adminId, action, userData) {
        try {
            switch (action) {
                case 'create':
                    return await User.create(userData);

                case 'update':
                    return await User.findByIdAndUpdate(
                        userData.userId,
                        userData.updates,
                        { new: true }
                    );

                case 'deactivate':
                    return await User.findByIdAndUpdate(
                        userData.userId,
                        { isActive: false },
                        { new: true }
                    );

                case 'approve':
                    return await User.findByIdAndUpdate(
                        userData.userId,
                        { isApproved: true },
                        { new: true }
                    );

                case 'list':
                    return await User.find({ role: userData.role || {} })
                        .populate('assignedWarehouses primaryWarehouse');

                default:
                    throw new Error('Invalid action');
            }
        } catch (error) {
            logger.error('User management error:', error);
            throw error;
        }
    }

    static async generateSystemReports(adminId, reportType, filters = {}) {
        try {
            let reportData = {};

            switch (reportType) {
                case 'sales':
                    reportData = await Order.aggregate([
                        {
                            $match: {
                                ...filters,
                                status: 'delivered'
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$createdAt' },
                                    month: { $month: '$createdAt' }
                                },
                                totalSales: { $sum: '$totalAmount' },
                                orderCount: { $sum: 1 }
                            }
                        }
                    ]);
                    break;

                case 'inventory':
                    reportData = await Inventory.aggregate([
                        {
                            $match: filters
                        },
                        {
                            $group: {
                                _id: '$category',
                                totalStock: { $sum: '$current_stock' },
                                lowStockItems: {
                                    $sum: {
                                        $cond: [
                                            { $lt: ['$current_stock', '$minimum_stock_level'] },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ]);
                    break;

                case 'delivery':
                    reportData = await Delivery.aggregate([
                        {
                            $match: filters
                        },
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                avgDeliveryTime: { $avg: '$deliveryTime' }
                            }
                        }
                    ]);
                    break;

                default:
                    throw new Error('Invalid report type');
            }

            // Save report
            const report = await Report.create({
                generatedBy: adminId,
                reportType,
                data: reportData,
                filters,
                generatedAt: new Date()
            });

            return report;
        } catch (error) {
            logger.error('Report generation error:', error);
            throw error;
        }
    }

    // ============================================================================
    // WAREHOUSE FUNCTIONS - Warehouse management and operations
    // ============================================================================

    static async getWarehouseDashboard(userId) {
        try {
            const user = await User.findById(userId).populate('assignedWarehouses');
            const warehouseIds = user.assignedWarehouses.map(w => w._id);

            const [
                assignedInventory,
                pendingOrders,
                todayDeliveries,
                stockAlerts
            ] = await Promise.all([
                Inventory.find({ warehouseId: { $in: warehouseIds } })
                    .populate('warehouseId', 'name location'),
                Order.find({
                    'items.warehouseId': { $in: warehouseIds },
                    status: { $in: ['pending', 'confirmed'] }
                }).populate('customer', 'fullName'),
                Delivery.find({
                    warehouseId: { $in: warehouseIds },
                    scheduledDate: {
                        $gte: new Date().setHours(0, 0, 0, 0),
                        $lte: new Date().setHours(23, 59, 59, 999)
                    }
                }),
                Inventory.find({
                    warehouseId: { $in: warehouseIds },
                    $expr: { $lt: ['$current_stock', '$minimum_stock_level'] }
                })
            ]);

            return {
                summary: {
                    totalItems: assignedInventory.length,
                    pendingOrders: pendingOrders.length,
                    todayDeliveries: todayDeliveries.length,
                    stockAlerts: stockAlerts.length
                },
                inventory: assignedInventory,
                orders: pendingOrders,
                deliveries: todayDeliveries,
                alerts: stockAlerts
            };
        } catch (error) {
            logger.error('Warehouse dashboard error:', error);
            throw error;
        }
    }

    static async manageInventory(userId, action, inventoryData) {
        try {
            const user = await User.findById(userId).populate('assignedWarehouses');
            const warehouseIds = user.assignedWarehouses.map(w => w._id.toString());

            switch (action) {
                case 'update_stock':
                    const inventory = await Inventory.findById(inventoryData.inventoryId);
                    if (!warehouseIds.includes(inventory.warehouseId.toString())) {
                        throw new Error('Unauthorized warehouse access');
                    }

                    return await Inventory.findByIdAndUpdate(
                        inventoryData.inventoryId,
                        {
                            current_stock: inventoryData.newStock,
                            lastUpdated: new Date(),
                            lastUpdatedBy: userId
                        },
                        { new: true }
                    );

                case 'add_item':
                    if (!warehouseIds.includes(inventoryData.warehouseId)) {
                        throw new Error('Unauthorized warehouse access');
                    }

                    return await Inventory.create({
                        ...inventoryData,
                        createdBy: userId
                    });

                case 'transfer_stock':
                    // Handle stock transfer between warehouses
                    const sourceItem = await Inventory.findById(inventoryData.sourceId);
                    const targetItem = await Inventory.findById(inventoryData.targetId);

                    if (!warehouseIds.includes(sourceItem.warehouseId.toString()) ||
                        !warehouseIds.includes(targetItem.warehouseId.toString())) {
                        throw new Error('Unauthorized warehouse access');
                    }

                    // Update source inventory
                    sourceItem.current_stock -= inventoryData.quantity;
                    await sourceItem.save();

                    // Update target inventory
                    targetItem.current_stock += inventoryData.quantity;
                    await targetItem.save();

                    return { sourceItem, targetItem };

                default:
                    throw new Error('Invalid inventory action');
            }
        } catch (error) {
            logger.error('Inventory management error:', error);
            throw error;
        }
    }

    static async processWarehouseOrders(userId, orderId, action) {
        try {
            const user = await User.findById(userId).populate('assignedWarehouses');
            const warehouseIds = user.assignedWarehouses.map(w => w._id.toString());

            const order = await Order.findById(orderId)
                .populate('items.inventory');

            // Check if warehouse has access to this order
            const hasAccess = order.items.some(item =>
                warehouseIds.includes(item.warehouseId?.toString())
            );

            if (!hasAccess) {
                throw new Error('Unauthorized order access');
            }

            switch (action) {
                case 'prepare':
                    order.status = 'preparing';
                    order.preparedBy = userId;
                    order.preparedAt = new Date();
                    break;

                case 'ready':
                    order.status = 'ready_for_delivery';
                    order.readyAt = new Date();
                    break;

                case 'reject':
                    order.status = 'rejected';
                    order.rejectedBy = userId;
                    order.rejectedAt = new Date();
                    break;

                default:
                    throw new Error('Invalid order action');
            }

            await order.save();

            // Create notification
            await Notification.create({
                userId: order.customer,
                title: `Order ${order.orderNumber} ${action}d`,
                message: `Your order has been ${action}d by the warehouse team`,
                type: 'order_update',
                relatedId: orderId,
                relatedModel: 'Order'
            });

            return order;
        } catch (error) {
            logger.error('Order processing error:', error);
            throw error;
        }
    }

    // ============================================================================
    // CASHIER FUNCTIONS - Point of sale and payment operations
    // ============================================================================

    static async getCashierDashboard(userId) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [
                todayOrders,
                todayRevenue,
                pendingPayments,
                cashTransactions
            ] = await Promise.all([
                Order.find({
                    createdAt: { $gte: today },
                    createdBy: userId
                }).populate('customer', 'fullName'),
                Order.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: today },
                            createdBy: new mongoose.Types.ObjectId(userId),
                            paymentStatus: 'paid'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: '$totalAmount' }
                        }
                    }
                ]),
                Order.find({
                    paymentStatus: { $in: ['pending', 'partial'] },
                    assignedCashier: userId
                }),
                Order.find({
                    createdAt: { $gte: today },
                    paymentMethod: 'cash',
                    createdBy: userId
                })
            ]);

            return {
                summary: {
                    todayOrders: todayOrders.length,
                    todayRevenue: todayRevenue[0]?.totalRevenue || 0,
                    pendingPayments: pendingPayments.length,
                    cashTransactions: cashTransactions.length
                },
                orders: todayOrders,
                pendingPayments,
                recentTransactions: cashTransactions.slice(-10)
            };
        } catch (error) {
            logger.error('Cashier dashboard error:', error);
            throw error;
        }
    }

    static async processPayment(cashierId, orderId, paymentData) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update payment status
            order.paymentStatus = paymentData.status;
            order.paymentMethod = paymentData.method;
            order.amountPaid = paymentData.amount;
            order.paymentDate = new Date();
            order.processedBy = cashierId;

            if (paymentData.status === 'paid' && order.status === 'pending') {
                order.status = 'confirmed';
            }

            await order.save();

            // Create payment notification
            await Notification.create({
                userId: order.customer,
                title: 'Payment Processed',
                message: `Payment of Rs. ${paymentData.amount} has been processed for order ${order.orderNumber}`,
                type: 'payment_update',
                relatedId: orderId,
                relatedModel: 'Order'
            });

            // Log transaction
            await AuditLog.create({
                action: 'payment_processed',
                performedBy: cashierId,
                targetModel: 'Order',
                targetId: orderId,
                changes: {
                    paymentStatus: paymentData.status,
                    paymentMethod: paymentData.method,
                    amountPaid: paymentData.amount
                }
            });

            return order;
        } catch (error) {
            logger.error('Payment processing error:', error);
            throw error;
        }
    }

    static async generateReceipt(cashierId, orderId) {
        try {
            const order = await Order.findById(orderId)
                .populate('customer', 'fullName email phone')
                .populate('items.inventory', 'name price');

            const receipt = {
                receiptNumber: `RCP-${Date.now()}`,
                orderNumber: order.orderNumber,
                customer: order.customer,
                items: order.items,
                subtotal: order.subtotalAmount,
                tax: order.taxAmount,
                total: order.totalAmount,
                paymentMethod: order.paymentMethod,
                cashier: await User.findById(cashierId, 'fullName'),
                timestamp: new Date()
            };

            return receipt;
        } catch (error) {
            logger.error('Receipt generation error:', error);
            throw error;
        }
    }

    // ============================================================================
    // CUSTOMER FUNCTIONS - Customer-specific operations
    // ============================================================================

    static async getCustomerDashboard(customerId) {
        try {
            const [
                recentOrders,
                pendingDeliveries,
                orderHistory,
                notifications
            ] = await Promise.all([
                Order.find({ customer: customerId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate('items.inventory', 'name'),
                Delivery.find({ customerId })
                    .where('status').in(['scheduled', 'in_transit'])
                    .populate('orderId', 'orderNumber'),
                Order.aggregate([
                    { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),
                Notification.find({ userId: customerId, isRead: false })
                    .sort({ createdAt: -1 })
                    .limit(10)
            ]);

            return {
                summary: {
                    totalOrders: recentOrders.length,
                    pendingDeliveries: pendingDeliveries.length,
                    notifications: notifications.length
                },
                recentOrders,
                deliveries: pendingDeliveries,
                orderHistory,
                notifications
            };
        } catch (error) {
            logger.error('Customer dashboard error:', error);
            throw error;
        }
    }

    static async trackOrder(customerId, orderId) {
        try {
            const order = await Order.findOne({
                _id: orderId,
                customer: customerId
            })
                .populate('items.inventory', 'name')
                .populate('deliveries');

            if (!order) {
                throw new Error('Order not found or unauthorized access');
            }

            const tracking = {
                order,
                timeline: [
                    { status: 'placed', date: order.createdAt, completed: true },
                    { status: 'confirmed', date: order.confirmedAt, completed: !!order.confirmedAt },
                    { status: 'preparing', date: order.preparedAt, completed: !!order.preparedAt },
                    { status: 'shipped', date: order.shippedAt, completed: !!order.shippedAt },
                    { status: 'delivered', date: order.deliveredAt, completed: !!order.deliveredAt }
                ]
            };

            return tracking;
        } catch (error) {
            logger.error('Order tracking error:', error);
            throw error;
        }
    }

    static async submitFeedback(customerId, feedbackData) {
        try {
            const feedback = await CustomerFeedback.create({
                customer: customerId,
                orderId: feedbackData.orderId,
                rating: feedbackData.rating,
                comment: feedbackData.comment,
                category: feedbackData.category
            });

            // Notify admin about new feedback
            const adminUsers = await User.find({ role: 'admin' });
            for (const admin of adminUsers) {
                await Notification.create({
                    userId: admin._id,
                    title: 'New Customer Feedback',
                    message: `New feedback received with ${feedbackData.rating} stars`,
                    type: 'feedback',
                    relatedId: feedback._id,
                    relatedModel: 'CustomerFeedback'
                });
            }

            return feedback;
        } catch (error) {
            logger.error('Feedback submission error:', error);
            throw error;
        }
    }

    // ============================================================================
    // DRIVER FUNCTIONS - Delivery operations
    // ============================================================================

    static async getDriverDashboard(userId) {
        try {
            const driver = await Driver.findOne({ userId });
            if (!driver) {
                throw new Error('Driver profile not found');
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [
                todayDeliveries,
                pendingDeliveries,
                completedDeliveries,
                earnings
            ] = await Promise.all([
                Delivery.find({
                    driverId: driver._id,
                    scheduledDate: { $gte: today }
                }).populate('orderId', 'orderNumber customer')
                    .populate('customerId', 'fullName phone'),
                Delivery.find({
                    driverId: driver._id,
                    status: { $in: ['assigned', 'in_transit'] }
                }),
                Delivery.find({
                    driverId: driver._id,
                    status: 'delivered',
                    deliveredAt: { $gte: today }
                }),
                Delivery.aggregate([
                    {
                        $match: {
                            driverId: driver._id,
                            status: 'delivered',
                            deliveredAt: { $gte: today }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalEarnings: { $sum: '$deliveryFee' }
                        }
                    }
                ])
            ]);

            return {
                summary: {
                    todayDeliveries: todayDeliveries.length,
                    pendingDeliveries: pendingDeliveries.length,
                    completedDeliveries: completedDeliveries.length,
                    todayEarnings: earnings[0]?.totalEarnings || 0
                },
                deliveries: {
                    today: todayDeliveries,
                    pending: pendingDeliveries,
                    completed: completedDeliveries
                },
                driver
            };
        } catch (error) {
            logger.error('Driver dashboard error:', error);
            throw error;
        }
    }

    static async updateDeliveryStatus(userId, deliveryId, status, locationData = null) {
        try {
            const driver = await Driver.findOne({ userId });
            const delivery = await Delivery.findOne({
                _id: deliveryId,
                driverId: driver._id
            });

            if (!delivery) {
                throw new Error('Delivery not found or unauthorized access');
            }

            delivery.status = status;

            switch (status) {
                case 'picked_up':
                    delivery.pickedUpAt = new Date();
                    break;
                case 'in_transit':
                    delivery.transitStartedAt = new Date();
                    if (locationData) {
                        delivery.currentLocation = locationData;
                    }
                    break;
                case 'delivered':
                    delivery.deliveredAt = new Date();
                    if (locationData) {
                        delivery.deliveryLocation = locationData;
                    }
                    // Update order status
                    await Order.findByIdAndUpdate(delivery.orderId, {
                        status: 'delivered',
                        deliveredAt: new Date()
                    });
                    break;
            }

            await delivery.save();

            // Notify customer
            await Notification.create({
                userId: delivery.customerId,
                title: 'Delivery Update',
                message: `Your delivery is now ${status.replace('_', ' ')}`,
                type: 'delivery_update',
                relatedId: deliveryId,
                relatedModel: 'Delivery'
            });

            return delivery;
        } catch (error) {
            logger.error('Delivery status update error:', error);
            throw error;
        }
    }

    static async submitDeliveryProof(userId, deliveryId, proofData) {
        try {
            const driver = await Driver.findOne({ userId });
            const delivery = await Delivery.findOne({
                _id: deliveryId,
                driverId: driver._id
            });

            if (!delivery) {
                throw new Error('Delivery not found or unauthorized access');
            }

            delivery.deliveryProof = {
                photos: proofData.photos || [],
                signature: proofData.signature,
                notes: proofData.notes,
                timestamp: new Date()
            };

            delivery.status = 'delivered';
            delivery.deliveredAt = new Date();

            await delivery.save();

            return delivery;
        } catch (error) {
            logger.error('Delivery proof submission error:', error);
            throw error;
        }
    }

    // ============================================================================
    // EDITOR FUNCTIONS - Content management operations
    // ============================================================================

    static async getEditorDashboard(userId) {
        try {
            const [
                inventoryItems,
                recentUpdates,
                pendingApprovals
            ] = await Promise.all([
                Inventory.find({ lastUpdatedBy: userId })
                    .sort({ lastUpdated: -1 })
                    .limit(10),
                AuditLog.find({ performedBy: userId })
                    .sort({ timestamp: -1 })
                    .limit(20),
                Inventory.find({
                    status: 'pending_approval',
                    needsApproval: true
                })
            ]);

            return {
                summary: {
                    itemsManaged: inventoryItems.length,
                    recentUpdates: recentUpdates.length,
                    pendingApprovals: pendingApprovals.length
                },
                inventory: inventoryItems,
                recentActivity: recentUpdates,
                approvals: pendingApprovals
            };
        } catch (error) {
            logger.error('Editor dashboard error:', error);
            throw error;
        }
    }

    static async manageContent(userId, action, contentData) {
        try {
            switch (action) {
                case 'update_inventory':
                    const inventory = await Inventory.findByIdAndUpdate(
                        contentData.inventoryId,
                        {
                            ...contentData.updates,
                            lastUpdated: new Date(),
                            lastUpdatedBy: userId
                        },
                        { new: true }
                    );

                    // Log the update
                    await AuditLog.create({
                        action: 'inventory_updated',
                        performedBy: userId,
                        targetModel: 'Inventory',
                        targetId: contentData.inventoryId,
                        changes: contentData.updates
                    });

                    return inventory;

                case 'bulk_update':
                    const results = [];
                    for (const item of contentData.items) {
                        const updated = await Inventory.findByIdAndUpdate(
                            item.id,
                            {
                                ...item.updates,
                                lastUpdated: new Date(),
                                lastUpdatedBy: userId
                            },
                            { new: true }
                        );
                        results.push(updated);
                    }
                    return results;

                default:
                    throw new Error('Invalid content action');
            }
        } catch (error) {
            logger.error('Content management error:', error);
            throw error;
        }
    }
}

export default RoleBasedService;
