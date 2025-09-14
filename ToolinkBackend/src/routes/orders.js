import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import User from '../models/User.js';
import { authorize, authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply authentication to all order routes
router.use(authenticateToken);

// Get all orders
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            customer,
            startDate,
            endDate,
            search = '',
            sort = '-createdAt'
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            customer,
            startDate,
            endDate,
            sort
        };

        // Role-based filtering
        if (req.user.role === 'customer') {
            options.customerEmail = req.user.email; // Filter by customer email instead of ID
        }

        const result = await Order.searchOrders(search, options);

        res.json({
            success: true,
            data: result.orders,
            pagination: {
                page: result.page,
                pages: result.pages,
                total: result.total,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        logger.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders',
            errorType: 'FETCH_ORDERS_ERROR'
        });
    }
});

// Get order statistics
router.get('/stats', authorize('admin', 'cashier', 'warehouse'), async (req, res) => {
    try {
        const stats = await Order.getStatistics();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Get order statistics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order statistics',
            errorType: 'FETCH_STATS_ERROR'
        });
    }
});

// Get my orders (customer only)
router.get('/my-orders', async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            status
        };

        const result = await Order.getOrdersByCustomer(req.user._id, options);

        res.json({
            success: true,
            data: result.orders,
            pagination: {
                page: result.page,
                pages: result.pages,
                total: result.total,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        logger.error('Get my orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch your orders',
            errorType: 'FETCH_MY_ORDERS_ERROR'
        });
    }
});

// Get single order
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'fullName email phone')
            .populate('items.inventory', 'name sku unit category')
            .populate('delivery.driver', 'fullName phone email')
            .populate('approvedBy', 'fullName email')
            .populate('processedBy', 'fullName email')
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found',
                errorType: 'ORDER_NOT_FOUND'
            });
        }

        // Check if user can access this order
        if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                errorType: 'ACCESS_DENIED'
            });
        }

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Get order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order',
            errorType: 'FETCH_ORDER_ERROR'
        });
    }
});

// Create order
router.post('/', [
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.inventory').isMongoId().withMessage('Invalid inventory ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('shippingAddress.street').notEmpty().withMessage('Street address is required'),
    body('shippingAddress.city').notEmpty().withMessage('City is required'),
    body('shippingAddress.zipCode').notEmpty().withMessage('Zip code is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { items, shippingAddress, billingAddress, delivery, notes, customerEmail } = req.body;

        // Find or get customer
        let customer = req.user;
        if (customerEmail && req.user.role !== 'customer') {
            const foundCustomer = await User.findOne({ email: customerEmail });
            if (foundCustomer) {
                customer = foundCustomer;
            }
        }

        // First pass: Validate all items and check stock
        const validatedItems = [];
        let totalAmount = 0;

        for (const item of items) {
            const inventory = await Inventory.findById(item.inventory);

            if (!inventory || inventory.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    error: `Item ${inventory ? inventory.name : 'unknown'} is not available`,
                    errorType: 'ITEM_NOT_AVAILABLE'
                });
            }

            if (inventory.current_stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient stock for ${inventory.name}. Available: ${inventory.current_stock}`,
                    errorType: 'INSUFFICIENT_STOCK'
                });
            }

            const unitPrice = item.unitPrice || inventory.unitPrice || inventory.selling_price || inventory.cost || 0;
            const totalPrice = unitPrice * item.quantity;

            validatedItems.push({
                inventory: inventory._id,
                inventoryName: inventory.name,
                quantity: item.quantity,
                unitPrice,
                totalPrice,
                notes: item.notes || ''
            });

            totalAmount += totalPrice;
        }

        // Create order first
        const orderData = {
            customer: customer._id,
            items: validatedItems.map(item => ({
                inventory: item.inventory,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                notes: item.notes
            })),
            totalAmount,
            finalAmount: totalAmount,
            shippingAddress,
            billingAddress: billingAddress || shippingAddress,
            delivery,
            notes,
            createdBy: req.user._id
        };

        const order = new Order(orderData);
        await order.save();

        // Update inventory stock (with rollback on failure)
        const inventoryUpdates = [];
        try {
            for (const item of validatedItems) {
                const result = await Inventory.findByIdAndUpdate(
                    item.inventory,
                    {
                        $inc: {
                            current_stock: -item.quantity,
                            quantity: -item.quantity
                        }
                    },
                    { new: true }
                );

                if (!result) {
                    throw new Error(`Failed to update inventory for ${item.inventoryName}`);
                }

                inventoryUpdates.push({
                    inventoryId: item.inventory,
                    quantityDeducted: item.quantity,
                    name: item.inventoryName
                });

                logger.info(`Inventory updated: ${item.inventoryName} - deducted ${item.quantity}, new stock: ${result.current_stock}`);
            }
        } catch (inventoryError) {
            // Rollback: Delete the order and restore any inventory that was updated
            await Order.findByIdAndDelete(order._id);

            for (const update of inventoryUpdates) {
                await Inventory.findByIdAndUpdate(
                    update.inventoryId,
                    {
                        $inc: {
                            current_stock: update.quantityDeducted,
                            quantity: update.quantityDeducted
                        }
                    }
                );
                logger.info(`Inventory restored due to rollback: ${update.name} + ${update.quantityDeducted}`);
            }

            logger.error('Order creation failed during inventory update:', inventoryError);
            return res.status(500).json({
                success: false,
                error: 'Failed to update inventory. Order has been cancelled.',
                errorType: 'INVENTORY_UPDATE_FAILED',
                details: inventoryError.message
            });
        }

        // Populate order details for response
        await order.populate('customer', 'fullName email phone');
        await order.populate('items.inventory', 'name sku unit category');

        logger.info(`Order created successfully: ${order.orderNumber} by ${req.user.fullName} - Total: ${totalAmount}`);

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });
    } catch (error) {
        logger.error('Create order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order',
            errorType: 'CREATE_ORDER_ERROR',
            details: error.message
        });
    }
});

// Update order
router.put('/:id', authorize('admin', 'cashier', 'warehouse'), [
    body('items').optional().isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.inventory').optional().isMongoId().withMessage('Invalid inventory ID'),
    body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: 'Order not found',
                errorType: 'ORDER_NOT_FOUND'
            });
        }

        // Only allow editing pending orders
        if (order.status !== 'pending') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: 'Only pending orders can be edited',
                errorType: 'INVALID_ORDER_STATUS'
            });
        }

        const { items, shippingAddress, billingAddress, delivery, notes } = req.body;

        // If items are being updated, handle inventory changes
        if (items) {
            // First, restore old inventory
            for (const oldItem of order.items) {
                await Inventory.findByIdAndUpdate(
                    oldItem.inventory,
                    {
                        $inc: {
                            current_stock: oldItem.quantity,
                            quantity: oldItem.quantity
                        }
                    },
                    { session }
                );
            }

            // Validate new items and calculate totals
            let totalAmount = 0;
            const processedItems = [];

            for (const item of items) {
                const inventory = await Inventory.findById(item.inventory).session(session);

                if (!inventory || inventory.status !== 'active') {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: `Item ${inventory ? inventory.name : 'unknown'} is not available`,
                        errorType: 'ITEM_NOT_AVAILABLE'
                    });
                }

                if (inventory.current_stock < item.quantity) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: `Insufficient stock for ${inventory.name}. Available: ${inventory.current_stock}`,
                        errorType: 'INSUFFICIENT_STOCK'
                    });
                }

                const unitPrice = item.unitPrice || inventory.unitPrice || inventory.selling_price || inventory.cost || 0;
                const totalPrice = unitPrice * item.quantity;

                processedItems.push({
                    inventory: inventory._id,
                    quantity: item.quantity,
                    unitPrice,
                    totalPrice,
                    notes: item.notes || ''
                });

                totalAmount += totalPrice;
            }

            // Update inventory for new items
            for (const item of processedItems) {
                await Inventory.findByIdAndUpdate(
                    item.inventory,
                    {
                        $inc: {
                            current_stock: -item.quantity,
                            quantity: -item.quantity
                        }
                    },
                    { session }
                );
            }

            // Update order with new items
            order.items = processedItems;
            order.totalAmount = totalAmount;
            order.finalAmount = totalAmount;
        }

        // Update other allowed fields
        if (shippingAddress) order.shippingAddress = shippingAddress;
        if (billingAddress) order.billingAddress = billingAddress;
        if (delivery) order.delivery = delivery;
        if (notes !== undefined) order.notes = notes;

        order.updatedBy = req.user._id;
        await order.save({ session });

        await session.commitTransaction();

        // Populate order details for response
        await order.populate('customer', 'fullName email phone');
        await order.populate('items.inventory', 'name sku unit category');

        logger.info(`Order updated: ${order.orderNumber} by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Order updated successfully',
            data: order
        });
    } catch (error) {
        await session.abortTransaction();
        logger.error('Update order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update order',
            errorType: 'UPDATE_ORDER_ERROR',
            details: error.message
        });
    } finally {
        await session.endSession();
    }
});

// Update order status
router.patch('/:id/status', authorize('admin', 'cashier', 'warehouse'), async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        const { status, notes } = req.body;
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

        if (!validStatuses.includes(status)) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: 'Invalid status',
                errorType: 'INVALID_STATUS'
            });
        }

        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: 'Order not found',
                errorType: 'ORDER_NOT_FOUND'
            });
        }

        const previousStatus = order.status;
        order.status = status;
        order.updatedBy = req.user._id;

        if (notes) {
            order.notes = notes;
        }

        // Handle status-specific actions with inventory updates
        switch (status) {
            case 'confirmed':
                order.approvedBy = req.user._id;
                order.approvedAt = new Date();
                break;
            case 'processing':
                order.processedBy = req.user._id;
                order.processedAt = new Date();
                break;
            case 'delivered':
                if (order.delivery) {
                    order.delivery.actualDate = new Date();
                }
                break;
            case 'cancelled':
                // Restore inventory stock atomically
                for (const item of order.items) {
                    const result = await Inventory.findByIdAndUpdate(
                        item.inventory,
                        {
                            $inc: {
                                current_stock: item.quantity,
                                quantity: item.quantity
                            }
                        },
                        { session, new: true }
                    );

                    if (result) {
                        logger.info(`Inventory restored: ${result.name} - added ${item.quantity}, new stock: ${result.current_stock}`);
                    }
                }
                break;
            case 'refunded':
                // Similar to cancelled - restore inventory if not already done
                if (previousStatus !== 'cancelled') {
                    for (const item of order.items) {
                        const result = await Inventory.findByIdAndUpdate(
                            item.inventory,
                            {
                                $inc: {
                                    current_stock: item.quantity,
                                    quantity: item.quantity
                                }
                            },
                            { session, new: true }
                        );

                        if (result) {
                            logger.info(`Inventory restored for refund: ${result.name} - added ${item.quantity}, new stock: ${result.current_stock}`);
                        }
                    }
                }
                break;
        }

        await order.save({ session });
        await session.commitTransaction();

        logger.info(`Order status updated: ${order.orderNumber} from ${previousStatus} to ${status} by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Order status updated successfully',
            data: {
                id: order._id,
                orderNumber: order.orderNumber,
                previousStatus,
                currentStatus: status,
                updatedBy: req.user.fullName,
                updatedAt: order.updatedAt
            }
        });
    } catch (error) {
        await session.abortTransaction();
        logger.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update order status',
            errorType: 'UPDATE_STATUS_ERROR',
            details: error.message
        });
    } finally {
        await session.endSession();
    }
});

// Delete order (permanent deletion)
router.delete('/:id', authorize('admin', 'cashier'), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.inventory', 'name');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found',
                errorType: 'ORDER_NOT_FOUND'
            });
        }

        // Only allow deletion of pending orders
        if (order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Only pending orders can be deleted',
                errorType: 'INVALID_ORDER_STATUS'
            });
        }

        // Restore inventory stock (with rollback on failure)
        const inventoryRestores = [];
        try {
            for (const item of order.items) {
                const result = await Inventory.findByIdAndUpdate(
                    item.inventory._id,
                    {
                        $inc: {
                            current_stock: item.quantity,
                            quantity: item.quantity
                        }
                    },
                    { new: true }
                );

                if (result) {
                    inventoryRestores.push({
                        inventoryId: item.inventory._id,
                        quantityRestored: item.quantity,
                        name: item.inventory.name || result.name
                    });
                    logger.info(`Inventory restored for deleted order: ${result.name} - added ${item.quantity}, new stock: ${result.current_stock}`);
                }
            }
        } catch (inventoryError) {
            // Rollback: Restore previous inventory levels
            for (const restore of inventoryRestores) {
                await Inventory.findByIdAndUpdate(
                    restore.inventoryId,
                    {
                        $inc: {
                            current_stock: -restore.quantityRestored,
                            quantity: -restore.quantityRestored
                        }
                    }
                );
                logger.info(`Inventory rollback: ${restore.name} - ${restore.quantityRestored}`);
            }

            logger.error('Failed to restore inventory during order deletion:', inventoryError);
            return res.status(500).json({
                success: false,
                error: 'Failed to restore inventory. Order deletion cancelled.',
                errorType: 'INVENTORY_RESTORE_FAILED'
            });
        }

        // Hard delete order - permanently remove from database
        const deletedOrder = {
            id: order._id,
            orderNumber: order.orderNumber,
            deletedBy: req.user.fullName,
            deletedAt: new Date()
        };

        await Order.findByIdAndDelete(order._id);

        logger.info(`Order permanently deleted: ${order.orderNumber} by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Order permanently deleted from database',
            data: deletedOrder
        });
    } catch (error) {
        logger.error('Delete order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete order',
            errorType: 'DELETE_ORDER_ERROR',
            details: error.message
        });
    }
});

// Get orders by customer
router.get('/customer/:customerId', authorize('admin', 'cashier'), async (req, res) => {
    try {
        const { customerId } = req.params;
        const { page = 1, limit = 10, status } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            status
        };

        const result = await Order.getOrdersByCustomer(customerId, options);

        res.json({
            success: true,
            data: result.orders,
            pagination: {
                page: result.page,
                pages: result.pages,
                total: result.total,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        logger.error('Get orders by customer error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer orders',
            errorType: 'FETCH_CUSTOMER_ORDERS_ERROR'
        });
    }
});

export default router;
