import MainOrder from '../models/MainOrder.js';
import SubOrder from '../models/SubOrder.js';
import Material from '../models/Material.js';
import Warehouse from '../models/Warehouse.js';
import StockLedger from '../models/StockLedger.js';
import NotificationService from './NotificationService.js';

class OrderService {
    /**
     * Create a main order and automatically split into sub-orders
     */
    async createMainOrder(orderData, createdByUserId) {
        try {
            // Validate materials exist and are active
            const materialIds = orderData.items.map(item => item.materialId);
            const materials = await Material.find({
                _id: { $in: materialIds },
                isActive: true
            });

            if (materials.length !== materialIds.length) {
                throw new Error('One or more materials not found or inactive');
            }

            // Order management system - no pricing needed

            // Create main order
            const mainOrder = new MainOrder({
                ...orderData,
                createdBy: createdByUserId
            });

            await mainOrder.save();

            // Auto-split into sub-orders
            await this.splitMainOrder(mainOrder._id);

            return await MainOrder.findById(mainOrder._id)
                .populate('customerId', 'username email')
                .populate('items.materialId', 'name unit category')
                .populate('createdBy', 'username');
        } catch (error) {
            throw new Error(`Failed to create main order: ${error.message}`);
        }
    }

    /**
     * Split main order into sub-orders by material category and warehouse
     */
    /**
     * Get warehouse code based on material category
     * WM = Tools & Equipment, W1 = Sand & Aggregates, W2 = Blocks & Masonry, W3 = Steel & Metal
     */
    getWarehouseCodeByCategory(materialCategory) {
        const categoryMapping = {
            'Tools & Equipment': 'WM',
            'Safety Equipment': 'WM',
            'Hardware & Fasteners': 'WM',

            'Aggregates': 'W1',
            'Sand': 'W1',
            'Gravel': 'W1',

            'Bricks & Blocks': 'W2',
            'Cement': 'W2',
            'Concrete': 'W2',
            'Mortar': 'W2',

            'Steel & Reinforcement': 'W3',
            'Metal': 'W3',
            'Structural Steel': 'W3',
            'Pipes & Fittings': 'W3',
            'Plumbing': 'W3',

            // Default mappings for other categories
            'Roofing Materials': 'W2',
            'Electrical': 'W3',
            'Paint & Chemicals': 'W2',
            'Other': 'WM'
        };

        return categoryMapping[materialCategory] || 'WM';
    }

    /**
     * Find warehouse by warehouse code
     */
    async findWarehouseByCode(warehouseCode) {
        return await Warehouse.findOne({
            $or: [
                { code: warehouseCode },
                { name: { $regex: warehouseCode, $options: 'i' } }
            ],
            isActive: true
        });
    }

    async splitMainOrder(mainOrderId) {
        try {
            const mainOrder = await MainOrder.findById(mainOrderId)
                .populate({
                    path: 'items.materialId',
                    populate: {
                        path: 'category'
                    }
                })
                .populate('customerId', 'fullName email');

            if (!mainOrder) {
                throw new Error('Main order not found');
            }

            const warehouses = await Warehouse.find({ isActive: true });
            const subOrdersMap = new Map(); // Key: "warehouseCode"
            const subOrders = [];

            // Group items by material category and assign to specific warehouses
            for (const item of mainOrder.items) {
                const materialCategory = item.materialId.category;
                const warehouseCode = this.getWarehouseCodeByCategory(materialCategory);

                // Find the target warehouse for this material category
                let targetWarehouse = await this.findWarehouseByCode(warehouseCode);

                // If specific warehouse not found, use any available warehouse
                if (!targetWarehouse) {
                    targetWarehouse = warehouses[0];
                }

                // Find or create sub-order for this warehouse
                let subOrder = subOrdersMap.get(warehouseCode);
                if (!subOrder) {
                    // Calculate delivery date based on material category and warehouse location
                    const scheduledDate = this.calculateDeliveryDate(materialCategory, targetWarehouse, mainOrder.requestedDeliveryDate);

                    subOrder = new SubOrder({
                        mainOrderId: mainOrder._id,
                        warehouseId: targetWarehouse._id,
                        warehouseCode: warehouseCode, // Add warehouse code for easy identification
                        materialCategory: materialCategory,
                        items: [],
                        totalAmount: 0,
                        scheduledAt: scheduledDate.date,
                        scheduledTime: scheduledDate.time,
                        estimatedDuration: scheduledDate.estimatedDuration,
                        deliverySequence: this.getDeliverySequence(materialCategory)
                    });

                    subOrdersMap.set(warehouseCode, subOrder);
                }

                // Add item to sub-order
                subOrder.items.push({
                    materialId: item.materialId._id,
                    materialName: item.materialId.name,
                    qty: item.requestedQty, // Use full requested quantity
                    unitPrice: item.unitPrice,
                    totalPrice: item.requestedQty * item.unitPrice
                });

                subOrder.totalAmount += item.requestedQty * item.unitPrice;
            }

            // Save all sub-orders and add history
            for (const subOrder of subOrdersMap.values()) {
                await subOrder.save();
                await subOrder.addHistory('Sub-order created from main order splitting', mainOrder.createdBy);
                subOrders.push(subOrder);
            }

            // Update main order status and sub-order references
            if (subOrders.length > 0) {
                mainOrder.status = 'split_scheduled';
                mainOrder.subOrderIds = subOrders.map(so => so._id);
                await mainOrder.save();
            }

            // Send order confirmation with sub-order details
            await this.sendOrderConfirmationWithSubOrders(mainOrder, subOrders);

            // Send targeted notifications to each warehouse
            await this.sendWarehouseNotifications(mainOrder, subOrders);

            return subOrders;
        } catch (error) {
            throw new Error(`Failed to split main order: ${error.message}`);
        }
    }

    /**
     * Calculate delivery date and time based on material category and warehouse
     */
    calculateDeliveryDate(materialCategory, warehouse, requestedDate) {
        const baseDate = new Date(requestedDate || Date.now());
        let deliveryDate = new Date(baseDate);
        let estimatedDuration = 60; // Default 1 hour
        let timeSlot = '09:00'; // Default morning slot

        // Material category specific scheduling
        const categoryScheduling = {
            'Cement': { priority: 1, duration: 45, preferredTime: '08:00' },
            'Steel & Reinforcement': { priority: 2, duration: 90, preferredTime: '09:00' },
            'Aggregates': { priority: 3, duration: 60, preferredTime: '10:00' },
            'Bricks & Blocks': { priority: 4, duration: 75, preferredTime: '11:00' },
            'Roofing Materials': { priority: 5, duration: 60, preferredTime: '14:00' },
            'Electrical': { priority: 6, duration: 30, preferredTime: '15:00' },
            'Plumbing': { priority: 7, duration: 45, preferredTime: '15:30' },
            'Paint & Chemicals': { priority: 8, duration: 30, preferredTime: '16:00' },
            'Tools & Equipment': { priority: 9, duration: 45, preferredTime: '16:30' },
            'Safety Equipment': { priority: 10, duration: 30, preferredTime: '17:00' },
            'Hardware & Fasteners': { priority: 11, duration: 30, preferredTime: '17:30' },
            'Other': { priority: 12, duration: 45, preferredTime: '14:00' }
        };

        const categoryInfo = categoryScheduling[materialCategory] || categoryScheduling['Other'];

        // Add days based on category priority and warehouse processing time
        const additionalDays = Math.ceil(categoryInfo.priority / 4);
        deliveryDate.setDate(deliveryDate.getDate() + additionalDays);

        // Skip weekends
        while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
            deliveryDate.setDate(deliveryDate.getDate() + 1);
        }

        return {
            date: deliveryDate,
            time: categoryInfo.preferredTime,
            estimatedDuration: categoryInfo.duration
        };
    }

    /**
     * Get delivery sequence based on material category
     */
    getDeliverySequence(materialCategory) {
        const sequences = {
            'Cement': 1,
            'Steel & Reinforcement': 2,
            'Aggregates': 3,
            'Bricks & Blocks': 4,
            'Roofing Materials': 5,
            'Electrical': 6,
            'Plumbing': 7,
            'Paint & Chemicals': 8,
            'Tools & Equipment': 9,
            'Safety Equipment': 10,
            'Hardware & Fasteners': 11,
            'Other': 12
        };
        return sequences[materialCategory] || 12;
    }

    /**
     * Send order confirmation email with sub-order details
     */
    async sendOrderConfirmationWithSubOrders(mainOrder, subOrders) {
        try {
            const EmailService = await import('../utils/emailService.js');

            // Sort sub-orders by delivery sequence
            const sortedSubOrders = subOrders.sort((a, b) => a.deliverySequence - b.deliverySequence);

            const emailContent = {
                to: mainOrder.customerId.email,
                subject: `Order Confirmation - ${mainOrder.orderNumber}`,
                html: this.generateOrderConfirmationHTML(mainOrder, sortedSubOrders)
            };

            await EmailService.sendEmail(emailContent);

            // Log successful email send
            logger.info(`Order confirmation email sent to ${mainOrder.customerId.email} for order ${mainOrder.orderNumber}`);
        } catch (error) {
            logger.error('Failed to send order confirmation email:', error);
            // Don't throw error - email failure shouldn't break order creation
        }
    }

    /**
     * Generate HTML content for order confirmation email
     */
    generateOrderConfirmationHTML(mainOrder, subOrders) {
        let subOrdersHTML = '';

        subOrders.forEach((subOrder, index) => {
            const itemsHTML = subOrder.items.map(item => `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.materialName}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">Rs. ${item.unitPrice.toFixed(2)}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">Rs. ${item.totalPrice.toFixed(2)}</td>
                </tr>
            `).join('');

            subOrdersHTML += `
                <div style="margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
                    <h3 style="color: #2563eb; margin-bottom: 10px;">
                        Delivery ${index + 1}: ${subOrder.materialCategory} Materials
                    </h3>
                    <p><strong>Sub-Order Number:</strong> ${subOrder.subOrderNumber}</p>
                    <p><strong>Scheduled Date:</strong> ${subOrder.scheduledAt.toLocaleDateString()}</p>
                    <p><strong>Scheduled Time:</strong> ${subOrder.scheduledTime}</p>
                    <p><strong>Estimated Duration:</strong> ${subOrder.estimatedDuration} minutes</p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background-color: #f3f4f6;">
                                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: left;">Item</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: center;">Quantity</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: right;">Unit Price</th>
                                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #f9fafb; font-weight: bold;">
                                <td colspan="3" style="padding: 10px; border-top: 2px solid #ddd; text-align: right;">Subtotal:</td>
                                <td style="padding: 10px; border-top: 2px solid #ddd; text-align: right;">Rs. ${subOrder.totalAmount.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        });

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Order Confirmation</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0;">Order Confirmation</h1>
                    <p style="margin: 5px 0 0 0;">Thank you for your order with ToolLink!</p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
                    <h2 style="color: #1e40af; margin-top: 0;">Order Details</h2>
                    <p><strong>Order Number:</strong> ${mainOrder.orderNumber}</p>
                    <p><strong>Customer:</strong> ${mainOrder.customerId.fullName}</p>
                    <p><strong>Order Date:</strong> ${mainOrder.createdAt.toLocaleDateString()}</p>
                    <p><strong>Status:</strong> Split into ${subOrders.length} scheduled deliveries</p>
                </div>

                <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
                    <h2 style="color: #1e40af;">Scheduled Deliveries</h2>
                    <p>Your order has been split into multiple deliveries based on material types and warehouse availability:</p>

                    ${subOrdersHTML}

                    <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <h3 style="color: #0369a1; margin-top: 0;">Important Notes:</h3>
                        <ul>
                            <li>Each delivery will be made separately according to the scheduled times above</li>
                            <li>You will receive SMS notifications 2 hours before each delivery</li>
                            <li>Please ensure someone is available to receive the materials at the scheduled times</li>
                            <li>Contact us immediately if you need to reschedule any delivery</li>
                        </ul>
                    </div>
                </div>

                <div style="background-color: #1f2937; color: white; padding: 20px; border-radius: 0 0 8px 8px; text-align: center;">
                    <p>Questions? Contact us at <a href="mailto:support@toollink.com" style="color: #60a5fa;">support@toollink.com</a> or call +94 11 123 4567</p>
                    <p style="margin: 0;">Thank you for choosing ToolLink!</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Adjust sub-order before dispatch (only allowed before 'dispatched' status)
     */
    async adjustBeforeDispatch(subOrderId, updates, userId, userRole) {
        try {
            // Check role permissions
            const allowedRoles = ['cashier', 'editor', 'admin'];
            if (!allowedRoles.includes(userRole)) {
                throw new Error('Insufficient permissions to adjust orders');
            }

            const subOrder = await SubOrder.findById(subOrderId)
                .populate('materialId', 'name unit')
                .populate('warehouseId', 'name');

            if (!subOrder) {
                throw new Error('Sub-order not found');
            }

            // Check if order can still be adjusted
            if (['dispatched', 'delivered', 'failed'].includes(subOrder.status)) {
                throw new Error('Cannot adjust order after dispatch');
            }

            const oldValues = {
                qty: subOrder.qty,
                scheduledAt: subOrder.scheduledAt,
                notes: subOrder.notes
            };

            let hasChanges = false;

            // Update allowed fields
            if (updates.qty && updates.qty !== subOrder.qty) {
                // Validate stock availability
                const availableStock = await StockLedger.getCurrentStock(
                    subOrder.warehouseId._id,
                    subOrder.materialId._id
                );

                if (updates.qty > availableStock) {
                    throw new Error(`Insufficient stock. Available: ${availableStock} ${subOrder.materialId.unit}`);
                }

                subOrder.qty = updates.qty;
                hasChanges = true;
            }

            if (updates.scheduledAt && updates.scheduledAt !== subOrder.scheduledAt) {
                subOrder.scheduledAt = new Date(updates.scheduledAt);
                hasChanges = true;
            }

            if (updates.notes !== undefined && updates.notes !== subOrder.notes) {
                subOrder.notes = updates.notes;
                hasChanges = true;
            }

            if (hasChanges) {
                await subOrder.save();

                // Add history entry
                const changeDetails = Object.entries(updates)
                    .filter(([key, value]) => oldValues[key] !== value)
                    .map(([key, value]) => `${key}: ${oldValues[key]} → ${value}`)
                    .join(', ');

                await subOrder.addHistory(
                    'Order adjusted before dispatch',
                    userId,
                    `Changes: ${changeDetails}`
                );

                // Notify warehouse manager
                await NotificationService.create(
                    'warehouse',
                    null,
                    'ORDER_STATUS_CHANGE',
                    `Sub-order ${subOrder.subOrderNumber} has been adjusted`,
                    {
                        subOrderId: subOrder._id,
                        changes: changeDetails
                    }
                );
            }

            return subOrder;
        } catch (error) {
            throw new Error(`Failed to adjust sub-order: ${error.message}`);
        }
    }

    /**
     * Update sub-order status
     */
    async updateSubOrderStatus(subOrderId, newStatus, userId, note = '') {
        try {
            const subOrder = await SubOrder.findById(subOrderId);
            if (!subOrder) {
                throw new Error('Sub-order not found');
            }

            const oldStatus = subOrder.status;
            await subOrder.updateStatus(newStatus, userId, note);

            // Trigger notifications based on status
            if (newStatus === 'dispatched') {
                const mainOrder = await MainOrder.findById(subOrder.mainOrderId)
                    .populate('customerId', 'email username');

                await NotificationService.create(
                    null,
                    mainOrder.customerId._id,
                    'UPCOMING_DELIVERY',
                    `Your order ${subOrder.subOrderNumber} has been dispatched`,
                    {
                        subOrderId: subOrder._id,
                        estimatedDelivery: subOrder.scheduledAt
                    }
                );
            }

            if (newStatus === 'delivered') {
                await this.checkMainOrderCompletion(subOrder.mainOrderId);
            }

            return subOrder;
        } catch (error) {
            throw new Error(`Failed to update sub-order status: ${error.message}`);
        }
    }

    /**
     * Check if main order is completed (all sub-orders delivered)
     */
    async checkMainOrderCompletion(mainOrderId) {
        try {
            const subOrders = await SubOrder.find({ mainOrderId });
            const allDelivered = subOrders.every(so => so.status === 'delivered');

            if (allDelivered && subOrders.length > 0) {
                await MainOrder.findByIdAndUpdate(mainOrderId, {
                    status: 'completed'
                });

                const mainOrder = await MainOrder.findById(mainOrderId)
                    .populate('customerId', 'email username');

                await NotificationService.create(
                    null,
                    mainOrder.customerId._id,
                    'ORDER_STATUS_CHANGE',
                    'Your order has been completed successfully',
                    {
                        mainOrderId,
                        orderNumber: mainOrder.orderNumber
                    }
                );
            }
        } catch (error) {
            console.error('Error checking main order completion:', error);
        }
    }

    /**
     * Get orders by status and date range
     */
    async getOrders(filters = {}) {
        try {
            const query = {};

            if (filters.status) {
                query.status = filters.status;
            }

            if (filters.customerId) {
                query.customerId = filters.customerId;
            }

            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
                if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
            }

            return MainOrder.find(query)
                .populate('customerId', 'username email')
                .populate('items.materialId', 'name unit category')
                .populate('createdBy', 'username')
                .sort({ createdAt: -1 });
        } catch (error) {
            throw new Error(`Failed to get orders: ${error.message}`);
        }
    }

    /**
     * Send targeted notifications to warehouse managers about their relevant materials
     */
    async sendWarehouseNotifications(mainOrder, subOrders) {
        try {
            const User = await import('../models/User.js').then(module => module.default);

            // Group sub-orders by warehouse
            const warehouseGroups = {};

            for (const subOrder of subOrders) {
                const warehouseId = subOrder.warehouseId.toString();
                if (!warehouseGroups[warehouseId]) {
                    warehouseGroups[warehouseId] = {
                        warehouse: subOrder.warehouseId,
                        subOrders: []
                    };
                }
                warehouseGroups[warehouseId].subOrders.push(subOrder);
            }

            // Send notification to each warehouse
            for (const [warehouseId, group] of Object.entries(warehouseGroups)) {
                // Find warehouse managers for this warehouse
                const warehouseManagers = await User.find({
                    role: 'warehouse',
                    assignedWarehouses: warehouseId,
                    isActive: true
                });

                if (warehouseManagers.length === 0) {
                    console.warn(`No warehouse managers found for warehouse ${warehouseId}`);
                    continue;
                }

                // Create notification for each warehouse manager
                for (const manager of warehouseManagers) {
                    const materialsList = group.subOrders.map(so =>
                        `${so.materialCategory}: ${so.items.length} items`
                    ).join(', ');

                    await NotificationService.create(
                        'WAREHOUSE_MANAGER',
                        manager._id,
                        'NEW_ORDER_RECEIVED',
                        `New order received for your warehouse. Materials: ${materialsList}`,
                        {
                            mainOrderId: mainOrder._id,
                            mainOrderNumber: mainOrder.orderNumber,
                            subOrderIds: group.subOrders.map(so => so._id),
                            warehouseId: warehouseId,
                            totalItems: group.subOrders.reduce((sum, so) => sum + so.items.length, 0),
                            customerName: mainOrder.customerId.username,
                            customerEmail: mainOrder.customerId.email,
                            actionUrl: `/warehouse/orders/received/${mainOrder._id}`,
                            priority: 'high'
                        }
                    );

                    console.log(`Notification sent to warehouse manager ${manager.email} for order ${mainOrder.orderNumber}`);
                }
            }

            console.log(`Warehouse notifications sent for order ${mainOrder.orderNumber} to ${Object.keys(warehouseGroups).length} warehouses`);
        } catch (error) {
            console.error('Failed to send warehouse notifications:', error);
            // Don't throw error - notification failure shouldn't break order creation
        }
    }
}

export default new OrderService();
