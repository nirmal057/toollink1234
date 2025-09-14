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

            // Calculate item prices
            const materialPriceMap = new Map(materials.map(m => [m._id.toString(), m.sellingPrice]));

            orderData.items.forEach(item => {
                item.unitPrice = materialPriceMap.get(item.materialId.toString()) || 0;
                item.totalPrice = item.unitPrice * item.requestedQty;
            });

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
     * Split main order into warehouse-specific sub-orders
     */
    async splitMainOrder(mainOrderId) {
        try {
            const mainOrder = await MainOrder.findById(mainOrderId)
                .populate('items.materialId');

            if (!mainOrder) {
                throw new Error('Main order not found');
            }

            const warehouses = await Warehouse.find({ isActive: true });
            const subOrders = [];

            // For each item in the main order
            for (const item of mainOrder.items) {
                let remainingQty = item.requestedQty;

                // Determine warehouse priority (preferred first, then by stock availability)
                let warehousePriority = [...warehouses];

                if (item.preferredWarehouseId) {
                    const preferredWarehouse = warehouses.find(w =>
                        w._id.toString() === item.preferredWarehouseId.toString()
                    );
                    if (preferredWarehouse) {
                        warehousePriority = [preferredWarehouse, ...warehouses.filter(w =>
                            w._id.toString() !== item.preferredWarehouseId.toString()
                        )];
                    }
                }

                // Allocate quantity across warehouses
                for (const warehouse of warehousePriority) {
                    if (remainingQty <= 0) break;

                    const availableStock = await StockLedger.getCurrentStock(
                        warehouse._id,
                        item.materialId._id
                    );

                    if (availableStock > 0) {
                        const allocatedQty = Math.min(remainingQty, availableStock);

                        const subOrder = new SubOrder({
                            mainOrderId: mainOrder._id,
                            warehouseId: warehouse._id,
                            materialId: item.materialId._id,
                            qty: allocatedQty,
                            unitPrice: item.unitPrice,
                            scheduledAt: mainOrder.scheduledDate
                        });

                        await subOrder.addHistory('Sub-order created from main order', mainOrder.createdBy);
                        subOrders.push(subOrder);

                        remainingQty -= allocatedQty;
                    }
                }

                // If quantity couldn't be fully allocated, create notification
                if (remainingQty > 0) {
                    await NotificationService.create(
                        'warehouse',
                        null,
                        'MATERIAL_REFILL_NEEDED',
                        `Insufficient stock for ${item.materialId.name}. Short by ${remainingQty} ${item.materialId.unit}`,
                        {
                            materialId: item.materialId._id,
                            shortQuantity: remainingQty,
                            mainOrderId: mainOrder._id
                        }
                    );
                }
            }

            // Update main order status
            if (subOrders.length > 0) {
                mainOrder.status = 'scheduled';
                await mainOrder.save();
            }

            return subOrders;
        } catch (error) {
            throw new Error(`Failed to split main order: ${error.message}`);
        }
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
}

export default new OrderService();
