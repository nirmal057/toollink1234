import express from 'express';
import { authorize, authenticateToken } from '../middleware/auth.js';
import Delivery from '../models/Delivery.js';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply authentication to all delivery routes
router.use(authenticateToken);

// Create delivery from confirmed order (Warehouse-based splitting)
router.post('/create-from-order', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { orderId, deliveryDate, timeSlot, deliveryAddress, contactNumber, specialInstructions } = req.body;

        // Validate delivery date (must be tomorrow or later)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const selectedDate = new Date(deliveryDate);
        if (selectedDate < tomorrow) {
            return res.status(400).json({
                success: false,
                message: 'Delivery date must be tomorrow or later'
            });
        }

        // Get the order with populated inventory items
        const order = await Order.findById(orderId)
            .populate('customerId', 'email name phone')
            .populate('items.inventoryId');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'Order must be confirmed before creating delivery'
            });
        }

        // Group items by warehouse
        const warehouseGroups = {};
        for (const item of order.items) {
            const inventory = item.inventoryId;
            const warehouseKey = inventory.warehouse || 'default';

            if (!warehouseGroups[warehouseKey]) {
                warehouseGroups[warehouseKey] = {
                    warehouseId: warehouseKey,
                    warehouseName: getWarehouseName(warehouseKey),
                    items: []
                };
            }

            warehouseGroups[warehouseKey].items.push({
                inventoryId: inventory._id,
                itemName: inventory.name,
                category: inventory.category,
                quantity: item.quantity,
                warehouse: warehouseKey
            });
        }

        // Create separate delivery for each warehouse
        const deliveries = [];
        for (const [warehouseId, warehouseData] of Object.entries(warehouseGroups)) {
            const delivery = new Delivery({
                orderId: order._id,
                customerId: order.customerId._id,
                customerEmail: order.customerId.email,
                warehouseId: warehouseData.warehouseId,
                warehouseName: warehouseData.warehouseName,
                items: warehouseData.items,
                deliveryAddress,
                deliveryDate: selectedDate,
                timeSlot,
                contactNumber,
                specialInstructions,
                createdBy: req.user.userId
            });

            await delivery.save();
            deliveries.push(delivery);
        }

        // Update order status to include delivery info
        order.status = 'delivery_scheduled';
        order.deliveryScheduled = true;
        await order.save();

        res.status(201).json({
            success: true,
            message: `Created ${deliveries.length} delivery schedule(s) for different warehouses`,
            deliveries: deliveries.map(d => ({
                id: d._id,
                trackingNumber: d.trackingNumber,
                warehouseName: d.warehouseName,
                itemCount: d.items.length,
                deliveryDate: d.deliveryDate,
                timeSlot: d.timeSlot
            }))
        });

    } catch (error) {
        logger.error('Error creating delivery from order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create delivery',
            error: error.message
        });
    }
});

// Get deliveries for customer (filtered by email and optionally order ID)
router.get('/customer', async (req, res) => {
    try {
        const { email, orderId } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const deliveries = await Delivery.getCustomerDeliveries(email, orderId);

        res.json({
            success: true,
            deliveries: deliveries.map(delivery => ({
                id: delivery._id,
                trackingNumber: delivery.trackingNumber,
                warehouseName: delivery.warehouseName,
                items: delivery.items,
                deliveryDate: delivery.deliveryDate,
                timeSlot: delivery.timeSlot,
                status: delivery.status,
                deliveryAddress: delivery.deliveryAddress,
                estimatedDeliveryTime: delivery.estimatedDeliveryTime,
                statusHistory: delivery.statusHistory,
                orderNumber: delivery.orderId?.orderNumber,
                createdAt: delivery.createdAt
            }))
        });

    } catch (error) {
        logger.error('Error fetching customer deliveries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch deliveries',
            error: error.message
        });
    }
});

// Get all deliveries (Admin, Warehouse, Cashier)
router.get('/', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { status, date, warehouseId, page = 1, limit = 20 } = req.query;

        const query = {};

        if (status) query.status = status;
        if (warehouseId) query.warehouseId = warehouseId;
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.deliveryDate = { $gte: startDate, $lte: endDate };
        }

        const deliveries = await Delivery.find(query)
            .populate('orderId', 'orderNumber totalAmount')
            .populate('customerId', 'name email phone')
            .populate('assignedDriver', 'name phone email')
            .sort({ deliveryDate: 1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Delivery.countDocuments(query);

        res.json({
            success: true,
            deliveries,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalDeliveries: total,
                hasMore: page * limit < total
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

// Get warehouse deliveries
router.get('/warehouse/:warehouseId', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const { date } = req.query;

        const deliveries = await Delivery.getWarehouseDeliveries(warehouseId, date);

        res.json({
            success: true,
            deliveries,
            warehouseId,
            date: date || 'all'
        });

    } catch (error) {
        logger.error('Error fetching warehouse deliveries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch warehouse deliveries',
            error: error.message
        });
    }
});

// Update delivery status
router.patch('/:deliveryId/status', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const { status, notes, assignedDriver } = req.body;

        const delivery = await Delivery.findById(deliveryId);
        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Update status using the model method
        await delivery.updateStatus(status, req.user.userId, notes);

        if (assignedDriver) {
            delivery.assignedDriver = assignedDriver;
            await delivery.save();
        }

        res.json({
            success: true,
            message: 'Delivery status updated successfully',
            delivery: {
                id: delivery._id,
                status: delivery.status,
                trackingNumber: delivery.trackingNumber,
                statusHistory: delivery.statusHistory
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

// Get delivery calendar data
router.get('/calendar', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { month, year, warehouseId } = req.query;

        const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()), 1);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

        const query = {
            deliveryDate: {
                $gte: startDate,
                $lte: endDate
            }
        };

        if (warehouseId) {
            query.warehouseId = warehouseId;
        }

        const deliveries = await Delivery.find(query)
            .populate('customerId', 'name email')
            .select('deliveryDate timeSlot status warehouseName customerEmail items')
            .sort({ deliveryDate: 1 });

        // Group by date
        const calendarData = {};
        deliveries.forEach(delivery => {
            const dateKey = delivery.deliveryDate.toISOString().split('T')[0];
            if (!calendarData[dateKey]) {
                calendarData[dateKey] = [];
            }
            calendarData[dateKey].push({
                id: delivery._id,
                timeSlot: delivery.timeSlot,
                status: delivery.status,
                warehouseName: delivery.warehouseName,
                customerEmail: delivery.customerEmail,
                itemCount: delivery.items.length
            });
        });

        res.json({
            success: true,
            calendarData,
            month: startDate.getMonth() + 1,
            year: startDate.getFullYear()
        });

    } catch (error) {
        logger.error('Error fetching calendar data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar data',
            error: error.message
        });
    }
});

// Helper function to get warehouse name
function getWarehouseName(warehouseId) {
    const warehouseNames = {
        'river_sand_warehouse': 'River Sand Warehouse',
        'metal_warehouse': 'Metal Products Warehouse',
        'wood_warehouse': 'Wood & Timber Warehouse',
        'concrete_warehouse': 'Concrete Products Warehouse',
        'default': 'Main Warehouse'
    };
    return warehouseNames[warehouseId] || warehouseId;
}

export default router;
