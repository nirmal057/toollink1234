import mongoose from 'mongoose';
import Order from '../models/Order.js';
import SubOrder from '../models/SubOrder.js';
import Inventory from '../models/Inventory.js';
import Delivery from '../models/Delivery.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import EmailService from './EmailService.js';
import PredictionService from './PredictionService.js';
import InventoryService from './InventoryService.js';
import logger from '../utils/logger.js';

class EnhancedOrderService {
    /**
     * Create order with comprehensive integration
     * - Real-time inventory checking
     * - Automatic warehouse splitting
     * - Delivery scheduling
     * - Customer notifications
     */
    static async createOrderWithIntegration(orderData, userId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            logger.info(`Creating enhanced order for user ${userId} with ${orderData.items?.length || 0} items`);
            logger.info(`Order data received:`, JSON.stringify(orderData, null, 2));
            logger.info(`User ID received:`, userId);

            // 1. Validate inventory availability across warehouses
            const inventoryValidation = await this.validateOrderInventory(orderData.items);
            if (!inventoryValidation.isValid) {
                throw new Error(`Insufficient inventory: ${inventoryValidation.errors.join(', ')}`);
            }

            // 2. Get user details for required fields
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // 3. Create main order - handle customer field properly
            const orderPayload = {
                ...orderData,
                customer: userId, // Set customer to the authenticated user ID
                customerEmail: user.email, // Set required customerEmail from user data
                createdBy: userId,
                status: 'pending'
            };

            // Remove customerName if it exists (not part of Order schema)
            if (orderPayload.customerName) {
                delete orderPayload.customerName;
            }

            logger.info(`Order payload before save:`, JSON.stringify(orderPayload, null, 2));

            const order = new Order(orderPayload);
            await order.save({ session });

            // 4. Split order by warehouse if needed
            const warehouseSplits = await this.splitOrderByWarehouse(order.items);
            const subOrders = [];

            for (const split of warehouseSplits) {
                const subOrder = await this.createSubOrder(order, split, session);
                subOrders.push(subOrder);
            }

            // 5. Reserve inventory
            await this.reserveInventoryForOrder(order.items, order._id, session);

            // 6. Create automatic delivery schedules
            const deliveries = await this.createDeliverySchedules(order, subOrders, session);

            // 7. Update prediction models
            await PredictionService.updateDemandPrediction(order.items);

            // 8. Send notifications
            await this.sendOrderNotifications(order, 'created');

            await session.commitTransaction();

            // 9. Return complete order with all related data
            const completeOrder = await Order.findById(order._id)
                .populate('customer')
                .populate('items.inventory')
                .populate('subOrders')
                .populate('deliveries');

            logger.info(`Enhanced order created: ${order.orderNumber} with ${subOrders.length} sub-orders and ${deliveries.length} deliveries`);

            return {
                success: true,
                order: completeOrder,
                subOrders,
                deliveries,
                analytics: await this.getOrderAnalytics(order._id)
            };

        } catch (error) {
            await session.abortTransaction();
            logger.error('Enhanced order creation failed:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Validate inventory availability across all warehouses
     */
    static async validateOrderInventory(items) {
        const validation = { isValid: true, errors: [], availability: [] };

        for (const item of items) {
            const inventory = await Inventory.findById(item.inventory);
            if (!inventory) {
                validation.isValid = false;
                validation.errors.push(`Item ${item.inventory} not found`);
                continue;
            }

            const availableStock = inventory.current_stock - (inventory.reserved_stock || 0);
            if (availableStock < item.quantity) {
                validation.isValid = false;
                validation.errors.push(`Insufficient stock for ${inventory.name}. Available: ${availableStock}, Required: ${item.quantity}`);
            }

            validation.availability.push({
                itemId: item.inventory,
                name: inventory.name,
                requested: item.quantity,
                available: availableStock,
                warehouse: inventory.location
            });
        }

        return validation;
    }

    /**
     * Split order by warehouse for optimal fulfillment
     */
    static async splitOrderByWarehouse(items) {
        const warehouseSplits = new Map();

        for (const item of items) {
            const inventory = await Inventory.findById(item.inventory).populate('warehouse');
            const warehouseId = inventory.warehouse?._id || 'default';

            if (!warehouseSplits.has(warehouseId)) {
                warehouseSplits.set(warehouseId, {
                    warehouseId,
                    warehouseName: inventory.warehouse?.name || 'Main Warehouse',
                    items: []
                });
            }

            warehouseSplits.get(warehouseId).items.push(item);
        }

        return Array.from(warehouseSplits.values());
    }

    /**
     * Create sub-order for warehouse-specific fulfillment
     */
    static async createSubOrder(parentOrder, warehouseSplit, session) {
        const subOrderData = {
            parentOrderId: parentOrder._id,
            parentOrderNumber: parentOrder.orderNumber,
            warehouse: {
                warehouseId: warehouseSplit.warehouseId,
                warehouseName: warehouseSplit.warehouseName
            },
            items: warehouseSplit.items,
            status: 'pending',
            priority: parentOrder.priority || 'normal'
        };

        const subOrder = new SubOrder(subOrderData);
        await subOrder.save({ session });

        // Add sub-order reference to parent order
        parentOrder.subOrders = parentOrder.subOrders || [];
        parentOrder.subOrders.push(subOrder._id);
        await parentOrder.save({ session });

        return subOrder;
    }

    /**
     * Reserve inventory for confirmed orders
     */
    static async reserveInventoryForOrder(items, orderId, session) {
        for (const item of items) {
            await Inventory.findByIdAndUpdate(
                item.inventory,
                {
                    $inc: { reserved_stock: item.quantity },
                    $push: {
                        reservations: {
                            orderId,
                            quantity: item.quantity,
                            reservedAt: new Date(),
                            status: 'active'
                        }
                    }
                },
                { session }
            );
        }
    }

    /**
     * Create automatic delivery schedules based on material type and location
     */
    static async createDeliverySchedules(order, subOrders, session) {
        const deliveries = [];

        try {
            // Get customer details if not populated
            let customer = order.customer;
            if (typeof customer === 'string' || !customer.fullName) {
                customer = await User.findById(order.customer);
            }

            for (const subOrder of subOrders) {
                // Calculate delivery priority based on material type
                const priority = await this.calculateDeliveryPriority(subOrder.items);

                // Estimate delivery date based on material type and distance
                const estimatedDate = await this.estimateDeliveryDate(subOrder);

                // Ensure delivery address is properly structured
                const deliveryAddress = {
                    street: order.shippingAddress?.street || 'Address not provided',
                    city: order.shippingAddress?.city || 'City not provided',
                    state: order.shippingAddress?.state || 'State not provided',
                    zipCode: order.shippingAddress?.zipCode || '00000',
                    country: order.shippingAddress?.country || 'Sri Lanka',
                    phone: order.shippingAddress?.phone || customer?.phone || 'Phone not provided'
                };

                const deliveryData = {
                    orderId: order._id,
                    subOrderId: subOrder._id,
                    customerName: customer?.fullName || customer?.name || order.customerName || 'Unknown Customer',
                    customerPhone: customer?.phone || order.shippingAddress?.phone || 'Phone not provided',
                    customerEmail: order.customerEmail || customer?.email || 'Email not provided',
                    deliveryAddress: deliveryAddress,
                    priority,
                    scheduledDate: estimatedDate,
                    status: 'pending',
                    specialInstructions: order.delivery?.notes || order.notes || '',
                    items: subOrder.items.map(item => ({
                        name: item.name || 'Unknown Item',
                        quantity: item.quantity || 0,
                        unit: item.unit || 'units'
                    }))
                };

                const delivery = new Delivery(deliveryData);
                await delivery.save({ session });
                deliveries.push(delivery);
            }
        } catch (error) {
            logger.error('Error creating delivery schedules:', error);
            throw new Error(`Failed to create delivery schedules: ${error.message}`);
        }

        return deliveries;
    }

    /**
     * Calculate delivery priority based on material urgency
     */
    static async calculateDeliveryPriority(items) {
        // High priority materials (cement, time-sensitive)
        const highPriorityMaterials = ['cement', 'concrete', 'fresh concrete', 'mortar'];

        const hasHighPriority = items.some(item =>
            highPriorityMaterials.some(material =>
                item.name.toLowerCase().includes(material)
            )
        );

        return hasHighPriority ? 'urgent' : 'normal';
    }

    /**
     * Estimate delivery date based on material type and Sri Lankan logistics
     */
    static async estimateDeliveryDate(subOrder) {
        const baseDate = new Date();

        // Standard delivery time in Sri Lanka: 1-3 days
        let deliveryDays = 1;

        // Check for monsoon season impact (May-September, October-January)
        const month = baseDate.getMonth() + 1;
        const isMonsoonSeason = (month >= 5 && month <= 9) || (month >= 10 || month <= 1);

        if (isMonsoonSeason) {
            deliveryDays += 1; // Add extra day during monsoon
        }

        // Check for holiday periods (April, December - Sri Lankan festival seasons)
        if (month === 4 || month === 12) {
            deliveryDays += 1; // Festival season delays
        }

        // Weekend adjustments
        const deliveryDate = new Date(baseDate);
        deliveryDate.setDate(baseDate.getDate() + deliveryDays);

        // Avoid Sunday deliveries
        if (deliveryDate.getDay() === 0) {
            deliveryDate.setDate(deliveryDate.getDate() + 1);
        }

        return deliveryDate;
    }

    /**
     * Send comprehensive order notifications
     */
    static async sendOrderNotifications(order, action) {
        try {
            // Get customer details
            const customer = await User.findById(order.customer);

            // Email notification to customer
            if (customer?.email) {
                await EmailService.sendOrderNotification(customer.email, order, action);
            }

            // Get all warehouses involved in this order
            const warehouseIds = new Set();
            const warehouseItems = new Map();

            for (const item of order.items) {
                const inventoryItem = await Inventory.findById(item.inventory);
                if (inventoryItem?.warehouse) {
                    warehouseIds.add(inventoryItem.warehouse);
                    if (!warehouseItems.has(inventoryItem.warehouse)) {
                        warehouseItems.set(inventoryItem.warehouse, []);
                    }
                    warehouseItems.get(inventoryItem.warehouse).push({
                        name: inventoryItem.name,
                        quantity: item.quantity,
                        unit: inventoryItem.unit
                    });
                }
            }

            // Send warehouse-specific notifications
            for (const warehouseId of warehouseIds) {
                const warehouseUsers = await User.find({
                    role: { $in: ['warehouse', 'manager', 'admin'] },
                    warehouse: warehouseId,
                    isActive: true
                });

                // Also get users without specific warehouse (admins)
                const generalAdmins = await User.find({
                    role: { $in: ['admin', 'manager'] },
                    $or: [
                        { warehouse: { $exists: false } },
                        { warehouse: null }
                    ],
                    isActive: true
                });

                const allRelevantUsers = [...warehouseUsers, ...generalAdmins];
                const items = warehouseItems.get(warehouseId) || [];
                const itemsText = items.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', ');

                for (const user of allRelevantUsers) {
                    await Notification.create({
                        userId: user._id,
                        title: `🏪 New Order for ${this.getWarehouseDisplayName(warehouseId)}: ${order.orderNumber}`,
                        message: `Order from ${customer?.fullName || 'Customer'} requires materials from your warehouse: ${itemsText}`,
                        category: 'order',
                        type: 'warehouse-order',
                        priority: order.priority || 'normal',
                        data: {
                            orderId: order._id,
                            orderNumber: order.orderNumber,
                            customerName: customer?.fullName,
                            warehouseId: warehouseId,
                            warehouseName: this.getWarehouseDisplayName(warehouseId),
                            items: items,
                            action: action
                        }
                    });
                }

                logger.info(`Warehouse notification sent to ${warehouseId} for order ${order.orderNumber} with items: ${itemsText}`);
            }

            // General notification for admins (overview)
            const adminUsers = await User.find({
                role: 'admin',
                isActive: true
            });

            for (const admin of adminUsers) {
                await Notification.create({
                    userId: admin._id,
                    title: `📋 Order Overview: ${order.orderNumber}`,
                    message: `New order spanning ${warehouseIds.size} warehouse(s) from ${customer?.fullName || 'Customer'}`,
                    category: 'order',
                    type: 'order-created',
                    priority: order.priority || 'normal',
                    data: {
                        orderId: order._id,
                        orderNumber: order.orderNumber,
                        customerName: customer?.fullName,
                        warehouseCount: warehouseIds.size,
                        warehouses: Array.from(warehouseIds)
                    }
                });
            }

            logger.info(`Enhanced order notifications sent for ${order.orderNumber} to ${warehouseIds.size} warehouses`);
        } catch (error) {
            logger.error('Failed to send order notifications:', error);
        }
    }

    /**
     * Update order with real-time inventory checking
     */
    static async updateOrderWithValidation(orderId, updateData, userId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // If items are being updated, validate inventory
            if (updateData.items) {
                const inventoryValidation = await this.validateOrderInventory(updateData.items);
                if (!inventoryValidation.isValid) {
                    throw new Error(`Inventory validation failed: ${inventoryValidation.errors.join(', ')}`);
                }

                // Release old inventory reservations
                await this.releaseInventoryReservations(order.items, orderId, session);

                // Reserve new inventory
                await this.reserveInventoryForOrder(updateData.items, orderId, session);
            }

            // Update order
            Object.assign(order, updateData);
            order.updatedBy = userId;
            await order.save({ session });

            // Send update notifications
            await this.sendOrderNotifications(order, 'updated');

            await session.commitTransaction();

            logger.info(`Order ${order.orderNumber} updated successfully`);
            return order;

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Release inventory reservations
     */
    static async releaseInventoryReservations(items, orderId, session) {
        for (const item of items) {
            await Inventory.findByIdAndUpdate(
                item.inventory,
                {
                    $inc: { reserved_stock: -item.quantity },
                    $pull: { reservations: { orderId } }
                },
                { session }
            );
        }
    }

    /**
     * Get comprehensive order analytics
     */
    static async getOrderAnalytics(orderId) {
        const order = await Order.findById(orderId)
            .populate('items.inventory')
            .populate('subOrders')
            .populate('deliveries');

        const analytics = {
            orderValue: order.finalAmount,
            itemCount: order.items.length,
            warehouseCount: order.subOrders?.length || 0,
            deliveryCount: order.deliveries?.length || 0,
            estimatedDeliveryDate: null,
            profitMargin: 0,
            inventoryImpact: []
        };

        // Calculate profit margin
        let totalCost = 0;
        for (const item of order.items) {
            const inventory = item.inventory;
            totalCost += (inventory.cost || 0) * item.quantity;

            analytics.inventoryImpact.push({
                itemName: inventory.name,
                quantityUsed: item.quantity,
                stockAfter: inventory.current_stock - item.quantity,
                lowStockAlert: (inventory.current_stock - item.quantity) <= inventory.min_stock_level
            });
        }

        analytics.profitMargin = ((order.finalAmount - totalCost) / order.finalAmount) * 100;

        // Get earliest delivery date
        if (order.deliveries?.length > 0) {
            const deliveryDates = order.deliveries.map(d => d.scheduledDate).filter(Boolean);
            if (deliveryDates.length > 0) {
                analytics.estimatedDeliveryDate = Math.min(...deliveryDates.map(d => d.getTime()));
            }
        }

        return analytics;
    }

    /**
     * Cancel order with inventory restoration
     */
    static async cancelOrder(orderId, reason, userId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            if (['delivered', 'cancelled'].includes(order.status)) {
                throw new Error(`Cannot cancel order with status: ${order.status}`);
            }

            // Release inventory reservations
            await this.releaseInventoryReservations(order.items, orderId, session);

            // Update order status
            order.status = 'cancelled';
            order.cancelledAt = new Date();
            order.cancelReason = reason;
            order.cancelledBy = userId;
            await order.save({ session });

            // Cancel related deliveries
            await Delivery.updateMany(
                { orderId },
                {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancelReason: 'Order cancelled'
                },
                { session }
            );

            // Send cancellation notifications
            await this.sendOrderNotifications(order, 'cancelled');

            await session.commitTransaction();

            logger.info(`Order ${order.orderNumber} cancelled successfully`);
            return order;

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get display name for warehouse
     */
    static getWarehouseDisplayName(warehouseId) {
        const warehouseNames = {
            'main_warehouse': 'Main Warehouse',
            'north_warehouse': 'North Warehouse',
            'south_warehouse': 'South Warehouse',
            'east_warehouse': 'East Warehouse',
            'west_warehouse': 'West Warehouse',
            'central_warehouse': 'Central Warehouse'
        };
        return warehouseNames[warehouseId] || warehouseId || 'Unknown Warehouse';
    }
}

export default EnhancedOrderService;
