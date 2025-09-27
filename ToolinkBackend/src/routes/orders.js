import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import MainOrder from '../models/MainOrder.js';
import SubOrder from '../models/SubOrder.js';
import Material from '../models/Material.js';
import Warehouse from '../models/Warehouse.js';
import Inventory from '../models/Inventory.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { authorize, authenticateToken } from '../middleware/auth.js';
import OrderService from '../services/OrderService.js';
import logger from '../utils/logger.js';
import { sendEmail } from '../utils/emailService.js';

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
        } else if (req.user.role === 'warehouse') {
            // Warehouse users should only see orders for their assigned warehouses
            options.warehouseIds = req.user.assignedWarehouses || [];
            if (req.user.primaryWarehouse) {
                options.warehouseIds.push(req.user.primaryWarehouse);
            }
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

        const { items, shippingAddress, billingAddress, delivery, notes, customerEmail, customerName } = req.body;

        // Find or create customer
        let customer = req.user;

        // If customerEmail is provided and user is not a customer (admin/cashier creating order for someone)
        if (customerEmail && req.user.role !== 'customer') {
            let foundCustomer = await User.findOne({ email: customerEmail });

            if (!foundCustomer && customerName) {
                // Create new customer if not found
                foundCustomer = new User({
                    fullName: customerName,
                    email: customerEmail,
                    role: 'customer',
                    phone: shippingAddress.phone || '+94',
                    address: `${shippingAddress.street}, ${shippingAddress.city}`,
                    password: 'defaultPassword123', // Default password - customer should change it
                    isActive: true
                });
                await foundCustomer.save();
                logger.info(`New customer created: ${customerName} (${customerEmail})`);
            }

            if (foundCustomer) {
                customer = foundCustomer;
            }
        } else if (customerEmail && customerEmail !== req.user.email) {
            // Handle case where logged-in customer is placing order with different email
            const foundCustomer = await User.findOne({ email: customerEmail });
            if (foundCustomer) {
                customer = foundCustomer;
            }
        }

        // First pass: Validate all items and check stock
        const validatedItems = [];

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

            validatedItems.push({
                inventory: inventory._id,
                inventoryName: inventory.name,
                quantity: item.quantity,
                notes: item.notes || ''
            });
        }

        // Create order first
        const orderData = {
            customer: customer._id,
            customerEmail: customer.email, // Store customer email for easy lookup
            items: validatedItems.map(item => ({
                inventory: item.inventory,
                quantity: item.quantity,
                notes: item.notes
            })),
            shippingAddress,
            billingAddress: billingAddress || shippingAddress,
            delivery,
            notes,
            // Set status based on user role - customers need approval
            status: req.user.role === 'customer' ? 'Pending Approval' : (req.body.status || 'pending'),
            createdBy: req.user._id
        };

        const order = new Order(orderData);
        await order.save();

        // Update inventory stock ONLY if order doesn't need approval (non-customer orders)
        // For customer orders requiring approval, inventory will be updated upon approval
        const inventoryUpdates = [];
        if (req.user.role !== 'customer') {
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
        } else {
            logger.info(`Order created pending approval - inventory not deducted yet: ${order.orderNumber}`);
        }

        // Populate order details for response
        await order.populate('customer', 'fullName email phone');
        await order.populate('items.inventory', 'name sku unit category');

        // Send notifications for customer orders requiring approval
        if (req.user.role === 'customer') {
            try {
                // Find all users who can approve orders (admin, warehouse, cashier)
                const approvers = await User.find({
                    role: { $in: ['admin', 'warehouse', 'cashier'] },
                    isActive: true
                });

                // Create notifications for each approver
                const notifications = approvers.map(approver => ({
                    toUserId: approver._id,
                    toRole: approver.role.toUpperCase(),
                    type: 'NEW_ORDER_APPROVAL',
                    message: `New order #${order.orderNumber} from ${order.customer.fullName} requires approval. Total: $${order.totalAmount.toFixed(2)}`,
                    meta: {
                        orderId: order._id,
                        orderNumber: order.orderNumber,
                        customerName: order.customer.fullName,
                        customerEmail: order.customer.email,
                        totalAmount: order.totalAmount,
                        itemCount: order.items.length,
                        createdAt: order.createdAt
                    }
                }));

                // Save all notifications
                await Notification.insertMany(notifications);

                logger.info(`Order approval notifications sent for order ${order.orderNumber} to ${approvers.length} approvers`);
            } catch (notificationError) {
                // Don't fail the order creation if notifications fail
                logger.error('Failed to send order approval notifications:', notificationError);
            }
        }

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

// Approve order endpoint
router.patch('/:id/approve', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const order = await Order.findById(id)
            .populate('customer', 'fullName email')
            .populate('items.inventory', 'name');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        if (order.status !== 'Pending Approval') {
            return res.status(400).json({
                success: false,
                error: 'Order is not pending approval'
            });
        }

        // Check inventory availability before approval
        const inventoryUpdates = [];
        for (const item of order.items) {
            const inventory = await Inventory.findById(item.inventory._id);

            if (!inventory || inventory.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    error: `Item ${inventory ? inventory.name : 'unknown'} is no longer available`
                });
            }

            if (inventory.current_stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient stock for ${inventory.name}. Available: ${inventory.current_stock}, Required: ${item.quantity}`
                });
            }
        }

        // Update inventory stock upon approval
        try {
            for (const item of order.items) {
                const result = await Inventory.findByIdAndUpdate(
                    item.inventory._id,
                    {
                        $inc: {
                            current_stock: -item.quantity,
                            quantity: -item.quantity
                        }
                    },
                    { new: true }
                );

                if (!result) {
                    throw new Error(`Failed to update inventory for ${item.inventory.name}`);
                }

                inventoryUpdates.push({
                    inventoryId: item.inventory._id,
                    quantityDeducted: item.quantity,
                    name: item.inventory.name
                });

                logger.info(`Inventory updated on approval: ${item.inventory.name} - deducted ${item.quantity}, new stock: ${result.current_stock}`);
            }
        } catch (inventoryError) {
            // Rollback any inventory updates that succeeded
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
                logger.info(`Inventory restored due to approval failure: ${update.name} + ${update.quantityDeducted}`);
            }

            logger.error('Order approval failed during inventory update:', inventoryError);
            return res.status(500).json({
                success: false,
                error: 'Failed to update inventory during approval',
                details: inventoryError.message
            });
        }

        // Update order status to Confirmed
        order.status = 'Confirmed';
        order.approvedBy = req.user._id;
        order.approvedAt = new Date();
        if (notes) {
            order.notes = (order.notes || '') + `\nApproved by ${req.user.fullName}: ${notes}`;
        }

        await order.save();

        // Create notification for customer
        await Notification.create({
            toUserId: order.customer._id,
            type: 'ORDER_STATUS_CHANGE',
            message: `Your order #${order.orderNumber} has been approved and confirmed by ${req.user.fullName}`,
            meta: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                previousStatus: 'Pending Approval',
                newStatus: 'Confirmed',
                approvedBy: req.user.fullName,
                approvedAt: order.approvedAt
            }
        });

        // Send email confirmation to customer
        try {
            await sendEmail({
                to: order.customer.email,
                template: 'order-confirmed',
                data: {
                    customerName: order.customer.fullName,
                    orderNumber: order.orderNumber,
                    orderDate: order.createdAt.toLocaleDateString(),
                    approvedBy: req.user.fullName,
                    totalAmount: order.totalAmount.toFixed(2),
                    items: order.items.map(item => ({
                        name: item.inventory.name,
                        quantity: item.quantity
                    }))
                }
            });
            logger.info(`Order confirmation email sent to ${order.customer.email} for order ${order.orderNumber}`);
        } catch (emailError) {
            logger.error('Failed to send order confirmation email:', emailError);
            // Don't fail the approval if email fails
        }

        logger.info(`Order ${order.orderNumber} approved by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Order approved successfully',
            data: order
        });
    } catch (error) {
        logger.error('Order approval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve order',
            details: error.message
        });
    }
});

// Reject order endpoint
router.patch('/:id/reject', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Rejection reason is required'
            });
        }

        const order = await Order.findById(id).populate('customer', 'fullName email').populate('items.inventory', 'name');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        if (order.status !== 'Pending Approval') {
            return res.status(400).json({
                success: false,
                error: 'Order is not pending approval'
            });
        }

        // Restore inventory stock for rejected order
        for (const item of order.items) {
            await Inventory.findByIdAndUpdate(
                item.inventory._id,
                {
                    $inc: {
                        current_stock: item.quantity,
                        quantity: item.quantity
                    }
                }
            );
            logger.info(`Inventory restored for rejected order: ${item.inventory.name} + ${item.quantity}`);
        }

        // Update order status to Rejected
        order.status = 'Rejected';
        order.rejectedBy = req.user._id;
        order.rejectedAt = new Date();
        order.rejectionReason = reason;
        order.notes = (order.notes || '') + `\nRejected by ${req.user.fullName}: ${reason}`;

        await order.save();

        // Create notification for customer
        await Notification.create({
            toUserId: order.customer._id,
            type: 'ORDER_STATUS_CHANGE',
            message: `Your order #${order.orderNumber} has been rejected by ${req.user.fullName}. Reason: ${reason}`,
            meta: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                previousStatus: 'Pending Approval',
                newStatus: 'Rejected',
                rejectedBy: req.user.fullName,
                rejectedAt: order.rejectedAt,
                rejectionReason: reason
            }
        });

        logger.info(`Order ${order.orderNumber} rejected by ${req.user.fullName}. Reason: ${reason}`);

        res.json({
            success: true,
            message: 'Order rejected successfully',
            data: order
        });
    } catch (error) {
        logger.error('Order rejection error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject order',
            details: error.message
        });
    }
});

// Create main order with automatic splitting
router.post('/main-order', [
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.materialId').isMongoId().withMessage('Invalid material ID'),
    body('items.*.requestedQty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('deliveryAddress.street').notEmpty().withMessage('Street address is required'),
    body('deliveryAddress.city').notEmpty().withMessage('City is required'),
    body('deliveryAddress.zipCode').notEmpty().withMessage('Zip code is required'),
    body('requestedDeliveryDate').optional().isISO8601().withMessage('Invalid delivery date format')
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

        const {
            items,
            deliveryAddress,
            requestedDeliveryDate,
            notes,
            customerEmail,
            customerName
        } = req.body;

        // Find or create customer
        let customer = req.user;

        // If customerEmail is provided and user is not a customer (admin/cashier creating order for someone)
        if (customerEmail && req.user.role !== 'customer') {
            let foundCustomer = await User.findOne({ email: customerEmail });

            if (!foundCustomer && customerName) {
                // Create new customer if not found
                foundCustomer = new User({
                    fullName: customerName,
                    email: customerEmail,
                    role: 'customer',
                    phone: deliveryAddress.phone || '+94',
                    address: `${deliveryAddress.street}, ${deliveryAddress.city}`,
                    password: 'defaultPassword123', // Default password - customer should change it
                    isActive: true
                });
                await foundCustomer.save();
                logger.info(`New customer created: ${customerName} (${customerEmail})`);
            }

            if (foundCustomer) {
                customer = foundCustomer;
            }
        }

        // Validate all materials exist and are active
        const materialIds = items.map(item => item.materialId);
        const materials = await Material.find({
            _id: { $in: materialIds },
            isActive: true
        });

        if (materials.length !== materialIds.length) {
            return res.status(400).json({
                success: false,
                error: 'One or more materials not found or inactive',
                errorType: 'INVALID_MATERIALS'
            });
        }

        // Create material price map
        const materialPriceMap = new Map(materials.map(m => [m._id.toString(), m.sellingPrice]));

        // Prepare order data
        const orderData = {
            customerId: customer._id,
            items: items.map(item => ({
                materialId: item.materialId,
                requestedQty: item.requestedQty,
                preferredWarehouseId: item.preferredWarehouseId,
                unitPrice: materialPriceMap.get(item.materialId.toString()) || 0,
                totalPrice: (materialPriceMap.get(item.materialId.toString()) || 0) * item.requestedQty
            })),
            deliveryAddress,
            requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : null,
            scheduledDate: new Date(requestedDeliveryDate || Date.now()),
            scheduledTime: '09:00', // Default time
            notes,
            createdBy: req.user._id
        };

        // Calculate total amount
        orderData.totalAmount = orderData.items.reduce((total, item) => total + item.totalPrice, 0);

        // Create main order using OrderService
        const orderService = new OrderService();
        const mainOrder = await orderService.createMainOrder(orderData, req.user._id);

        // Populate the response with customer and material details
        await mainOrder.populate([
            { path: 'customerId', select: 'fullName email phone' },
            { path: 'items.materialId', select: 'name category unit sku' },
            { path: 'createdBy', select: 'fullName role' }
        ]);

        // Get the created sub-orders
        const subOrders = await SubOrder.find({ mainOrderId: mainOrder._id })
            .populate('warehouseId', 'name location')
            .populate('items.materialId', 'name category unit');

        logger.info(`Main order created successfully: ${mainOrder.orderNumber} by ${req.user.fullName} - Split into ${subOrders.length} sub-orders`);

        res.status(201).json({
            success: true,
            message: 'Main order created and split successfully',
            data: {
                mainOrder,
                subOrders: subOrders.map(subOrder => ({
                    _id: subOrder._id,
                    subOrderNumber: subOrder.subOrderNumber,
                    materialCategory: subOrder.materialCategory,
                    warehouseName: subOrder.warehouseId.name,
                    scheduledAt: subOrder.scheduledAt,
                    scheduledTime: subOrder.scheduledTime,
                    estimatedDuration: subOrder.estimatedDuration,
                    totalAmount: subOrder.totalAmount,
                    status: subOrder.status,
                    items: subOrder.items
                }))
            }
        });

    } catch (error) {
        logger.error('Create main order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create main order',
            errorType: 'CREATE_MAIN_ORDER_ERROR',
            details: error.message
        });
    }
});

// Get main order with sub-orders
router.get('/main-order/:id', async (req, res) => {
    try {
        const mainOrder = await MainOrder.findById(req.params.id)
            .populate('customerId', 'fullName email phone')
            .populate('items.materialId', 'name category unit sku')
            .populate('createdBy', 'fullName role');

        if (!mainOrder) {
            return res.status(404).json({
                success: false,
                error: 'Main order not found'
            });
        }

        // Role-based access control
        if (req.user.role === 'customer' && mainOrder.customerId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get associated sub-orders
        const subOrders = await SubOrder.find({ mainOrderId: mainOrder._id })
            .populate('warehouseId', 'name location phone')
            .populate('items.materialId', 'name category unit')
            .sort({ deliverySequence: 1 });

        res.json({
            success: true,
            data: {
                mainOrder,
                subOrders
            }
        });

    } catch (error) {
        logger.error('Get main order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch main order',
            details: error.message
        });
    }
});

// Get all main orders
router.get('/main-orders', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            customerId,
            startDate,
            endDate,
            sort = '-createdAt'
        } = req.query;

        const query = {};

        // Role-based filtering
        if (req.user.role === 'customer') {
            query.customerId = req.user._id;
        } else if (req.user.role === 'warehouse') {
            // For warehouse users, filter main orders that have sub-orders in their assigned warehouses
            const userWarehouses = [
                ...(req.user.assignedWarehouses || []),
                ...(req.user.primaryWarehouse ? [req.user.primaryWarehouse] : [])
            ];

            if (userWarehouses.length > 0) {
                // Find sub-orders assigned to user's warehouses
                const relevantSubOrders = await SubOrder.find({
                    warehouseId: { $in: userWarehouses }
                }).distinct('mainOrderId');

                query._id = { $in: relevantSubOrders };
            } else {
                // If no warehouses assigned, show no orders
                query._id = { $in: [] };
            }
        } else if (customerId) {
            query.customerId = customerId;
        }

        if (status) query.status = status;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort,
            populate: [
                { path: 'customerId', select: 'fullName email phone' },
                { path: 'items.materialId', select: 'name category unit' },
                { path: 'createdBy', select: 'fullName role' }
            ]
        };

        const mainOrders = await MainOrder.paginate(query, options);

        // Get sub-order counts for each main order
        const mainOrderIds = mainOrders.docs.map(order => order._id);
        const subOrderCounts = await SubOrder.aggregate([
            { $match: { mainOrderId: { $in: mainOrderIds } } },
            { $group: { _id: '$mainOrderId', count: { $sum: 1 } } }
        ]);

        const subOrderCountMap = new Map(subOrderCounts.map(item => [item._id.toString(), item.count]));

        // Add sub-order counts to response
        const ordersWithCounts = mainOrders.docs.map(order => ({
            ...order.toObject(),
            subOrderCount: subOrderCountMap.get(order._id.toString()) || 0
        }));

        res.json({
            success: true,
            data: ordersWithCounts,
            pagination: {
                page: mainOrders.page,
                pages: mainOrders.totalPages,
                total: mainOrders.totalDocs,
                hasNextPage: mainOrders.hasNextPage,
                hasPrevPage: mainOrders.hasPrevPage
            }
        });

    } catch (error) {
        logger.error('Get main orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch main orders',
            details: error.message
        });
    }
});

// Update sub-order delivery schedule
router.put('/sub-order/:id/schedule', authorize('admin', 'cashier', 'warehouse'), [
    body('scheduledAt').isISO8601().withMessage('Invalid scheduled date format'),
    body('scheduledTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)')
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

        const { scheduledAt, scheduledTime, estimatedDuration } = req.body;

        const subOrder = await SubOrder.findById(req.params.id)
            .populate('mainOrderId', 'customerId orderNumber')
            .populate('warehouseId', 'name');

        if (!subOrder) {
            return res.status(404).json({
                success: false,
                error: 'Sub-order not found'
            });
        }

        // Only allow rescheduling before dispatch
        if (['dispatched', 'delivered'].includes(subOrder.status)) {
            return res.status(400).json({
                success: false,
                error: 'Cannot reschedule dispatched or delivered orders'
            });
        }

        const oldSchedule = {
            date: subOrder.scheduledAt,
            time: subOrder.scheduledTime
        };

        // Update schedule
        subOrder.scheduledAt = new Date(scheduledAt);
        subOrder.scheduledTime = scheduledTime;
        if (estimatedDuration) subOrder.estimatedDuration = estimatedDuration;
        subOrder.status = 'rescheduled';

        await subOrder.addHistory(
            `Delivery rescheduled from ${oldSchedule.date.toLocaleDateString()} ${oldSchedule.time} to ${subOrder.scheduledAt.toLocaleDateString()} ${scheduledTime}`,
            req.user._id,
            'Schedule updated by ' + req.user.fullName
        );

        // Notify customer about reschedule
        await Notification.create({
            toUserId: subOrder.mainOrderId.customerId,
            type: 'DELIVERY_RESCHEDULE',
            message: `Your delivery for ${subOrder.materialCategory} materials has been rescheduled to ${subOrder.scheduledAt.toLocaleDateString()} at ${scheduledTime}`,
            meta: {
                subOrderId: subOrder._id,
                subOrderNumber: subOrder.subOrderNumber,
                mainOrderNumber: subOrder.mainOrderId.orderNumber,
                materialCategory: subOrder.materialCategory,
                newSchedule: {
                    date: subOrder.scheduledAt,
                    time: scheduledTime
                },
                warehouseName: subOrder.warehouseId.name
            }
        });

        logger.info(`Sub-order ${subOrder.subOrderNumber} rescheduled by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Delivery schedule updated successfully',
            data: subOrder
        });

    } catch (error) {
        logger.error('Update sub-order schedule error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update delivery schedule',
            details: error.message
        });
    }
});

// Get sub-orders for warehouse users
router.get('/sub-orders', authorize('admin', 'warehouse', 'cashier'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            materialCategory,
            startDate,
            endDate,
            sort = '-scheduledAt'
        } = req.query;

        const query = {};

        // Role-based filtering for warehouse users
        if (req.user.role === 'warehouse') {
            const userWarehouses = [
                ...(req.user.assignedWarehouses || []),
                ...(req.user.primaryWarehouse ? [req.user.primaryWarehouse] : [])
            ];

            if (userWarehouses.length > 0) {
                query.warehouseId = { $in: userWarehouses };
            } else {
                // If no warehouses assigned, show no orders
                query.warehouseId = { $in: [] };
            }
        }

        if (status) query.status = status;
        if (materialCategory) query.materialCategory = materialCategory;
        if (startDate || endDate) {
            query.scheduledAt = {};
            if (startDate) query.scheduledAt.$gte = new Date(startDate);
            if (endDate) query.scheduledAt.$lte = new Date(endDate);
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort,
            populate: [
                { path: 'mainOrderId', select: 'orderNumber customerId' },
                { path: 'warehouseId', select: 'name location phone' },
                { path: 'items.materialId', select: 'name unit sku' }
            ]
        };

        const subOrders = await SubOrder.paginate(query, options);

        // Get customer details for each main order
        for (let subOrder of subOrders.docs) {
            if (subOrder.mainOrderId) {
                await subOrder.mainOrderId.populate('customerId', 'fullName email phone');
            }
        }

        res.json({
            success: true,
            data: subOrders.docs,
            pagination: {
                page: subOrders.page,
                pages: subOrders.totalPages,
                total: subOrders.totalDocs,
                hasNextPage: subOrders.hasNextPage,
                hasPrevPage: subOrders.hasPrevPage
            }
        });

    } catch (error) {
        logger.error('Get sub-orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sub-orders',
            details: error.message
        });
    }
});

// Update sub-order status (warehouse users)
router.put('/sub-order/:id/status', authorize('admin', 'warehouse', 'cashier'), [
    body('status').isIn(['created', 'scheduled', 'prepared', 'dispatched', 'delivered', 'failed', 'rescheduled']).withMessage('Invalid status'),
    body('notes').optional().isString().withMessage('Notes must be a string')
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

        const { status, notes } = req.body;
        const subOrder = await SubOrder.findById(req.params.id)
            .populate('mainOrderId', 'customerId orderNumber')
            .populate('warehouseId', 'name');

        if (!subOrder) {
            return res.status(404).json({
                success: false,
                error: 'Sub-order not found'
            });
        }

        // Check if warehouse user has access to this sub-order
        if (req.user.role === 'warehouse') {
            const userWarehouses = [
                ...(req.user.assignedWarehouses || []).map(id => id.toString()),
                ...(req.user.primaryWarehouse ? [req.user.primaryWarehouse.toString()] : [])
            ];

            if (!userWarehouses.includes(subOrder.warehouseId._id.toString())) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied - not assigned to this warehouse'
                });
            }
        }

        const oldStatus = subOrder.status;
        await subOrder.updateStatus(status, req.user._id, notes || `Status updated by ${req.user.fullName}`);

        // Create notification for customer
        await Notification.create({
            toUserId: subOrder.mainOrderId.customerId,
            type: 'SUB_ORDER_STATUS_UPDATE',
            message: `Your ${subOrder.materialCategory} delivery status updated to: ${status}`,
            meta: {
                subOrderId: subOrder._id,
                subOrderNumber: subOrder.subOrderNumber,
                mainOrderNumber: subOrder.mainOrderId.orderNumber,
                materialCategory: subOrder.materialCategory,
                previousStatus: oldStatus,
                newStatus: status,
                warehouseName: subOrder.warehouseId.name,
                updatedBy: req.user.fullName
            }
        });

        logger.info(`Sub-order ${subOrder.subOrderNumber} status updated from ${oldStatus} to ${status} by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Sub-order status updated successfully',
            data: subOrder
        });

    } catch (error) {
        logger.error('Update sub-order status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update sub-order status',
            details: error.message
        });
    }
});

// Get received order details for warehouse (when clicking notification)
router.get('/received/:mainOrderId', authorize(['warehouse', 'admin']), async (req, res) => {
    try {
        const { mainOrderId } = req.params;

        // Get main order with populated data
        const mainOrder = await MainOrder.findById(mainOrderId)
            .populate('customerId', 'username email phone address')
            .populate('items.materialId', 'name unit category sellingPrice')
            .populate('createdBy', 'username');

        if (!mainOrder) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        // Get sub-orders for this warehouse only
        let warehouseFilter = {};
        if (req.user.role === 'warehouse' && req.user.assignedWarehouses?.length > 0) {
            warehouseFilter.warehouseId = { $in: req.user.assignedWarehouses };
        }

        const subOrders = await SubOrder.find({
            mainOrderId: mainOrderId,
            ...warehouseFilter
        }).populate('warehouseId', 'name location contact');

        // Get warehouse information
        const warehouses = await Warehouse.find(warehouseFilter);

        res.json({
            success: true,
            data: {
                mainOrder,
                subOrders,
                warehouses,
                warehouseStats: {
                    totalSubOrders: subOrders.length,
                    totalItems: subOrders.reduce((sum, so) => sum + so.items.length, 0),
                    totalValue: subOrders.reduce((sum, so) => sum + so.totalAmount, 0)
                }
            }
        });
    } catch (error) {
        logger.error('Get received order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch received order details',
            details: error.message
        });
    }
});

// Generate PDF for order (warehouse can download order details as PDF)
router.get('/:orderId/pdf', authorize(['warehouse', 'admin', 'cashier']), async (req, res) => {
    try {
        const { orderId } = req.params;
        const { type = 'main' } = req.query; // 'main' or 'sub'

        let orderData;
        if (type === 'sub') {
            orderData = await SubOrder.findById(orderId)
                .populate('mainOrderId', 'orderNumber customerId requestedDeliveryDate')
                .populate('warehouseId', 'name location contact')
                .populate('items.materialId', 'name unit category');

            if (!orderData) {
                return res.status(404).json({
                    success: false,
                    error: 'Sub-order not found'
                });
            }
        } else {
            orderData = await MainOrder.findById(orderId)
                .populate('customerId', 'username email phone address')
                .populate('items.materialId', 'name unit category sellingPrice')
                .populate('createdBy', 'username');

            if (!orderData) {
                return res.status(404).json({
                    success: false,
                    error: 'Main order not found'
                });
            }
        }

        // Generate PDF content
        const pdfBuffer = await generateOrderPDF(orderData, type);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="order-${orderData.orderNumber || orderData.subOrderNumber}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Generate PDF error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate PDF',
            details: error.message
        });
    }
});

// Warehouse manager accepts order and creates delivery
router.post('/sub-order/:subOrderId/accept-and-create-delivery', authorize(['warehouse', 'admin']), async (req, res) => {
    try {
        const { subOrderId } = req.params;
        const { driverId, deliveryNotes, estimatedDeliveryTime } = req.body;

        // Validate required fields
        if (!driverId) {
            return res.status(400).json({
                success: false,
                error: 'Driver ID is required'
            });
        }

        // Get sub-order
        const subOrder = await SubOrder.findById(subOrderId)
            .populate('mainOrderId', 'customerId orderNumber')
            .populate('warehouseId', 'name location');

        if (!subOrder) {
            return res.status(404).json({
                success: false,
                error: 'Sub-order not found'
            });
        }

        // Check if user has access to this warehouse
        if (req.user.role === 'warehouse' &&
            !req.user.assignedWarehouses?.includes(subOrder.warehouseId._id.toString())) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this warehouse'
            });
        }

        // Verify driver exists and is available
        const Driver = await import('../models/Driver.js').then(module => module.default);
        const driver = await Driver.findById(driverId);

        if (!driver || !driver.isAvailable) {
            return res.status(400).json({
                success: false,
                error: 'Driver not found or not available'
            });
        }

        // Create delivery record
        const Delivery = await import('../models/Delivery.js').then(module => module.default);
        const delivery = new Delivery({
            orderId: subOrder._id,
            customerId: subOrder.mainOrderId.customerId,
            customerEmail: subOrder.mainOrderId.customerId.email,
            warehouseId: subOrder.warehouseId._id,
            warehouseName: subOrder.warehouseId.name,
            driverId: driverId,
            items: subOrder.items.map(item => ({
                inventoryId: item.materialId, // Assuming this maps to inventory
                itemName: item.materialName,
                category: subOrder.materialCategory,
                quantity: item.qty,
                warehouse: subOrder.warehouseId.name
            })),
            status: 'assigned',
            scheduledAt: estimatedDeliveryTime || subOrder.scheduledAt,
            notes: deliveryNotes || '',
            assignedBy: req.user._id,
            assignedAt: new Date()
        });

        await delivery.save();

        // Update sub-order status
        subOrder.status = 'accepted_ready_for_delivery';
        subOrder.acceptedAt = new Date();
        subOrder.acceptedBy = req.user._id;
        subOrder.deliveryId = delivery._id;
        await subOrder.save();

        // Update driver availability
        driver.isAvailable = false;
        driver.currentDeliveryId = delivery._id;
        await driver.save();

        // Send notification to customer about delivery assignment
        await NotificationService.create(
            'CUSTOMER',
            subOrder.mainOrderId.customerId,
            'ORDER_READY_FOR_DELIVERY',
            `Your order ${subOrder.subOrderNumber} has been accepted and assigned for delivery. Driver will contact you shortly.`,
            {
                subOrderId: subOrder._id,
                deliveryId: delivery._id,
                driverName: driver.name,
                driverPhone: driver.phone,
                estimatedDeliveryTime: delivery.scheduledAt
            }
        );

        res.json({
            success: true,
            message: 'Order accepted and delivery created successfully',
            data: {
                subOrder,
                delivery,
                driver: {
                    name: driver.name,
                    phone: driver.phone,
                    vehicleNumber: driver.vehicleNumber
                }
            }
        });
    } catch (error) {
        logger.error('Accept order and create delivery error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept order and create delivery',
            details: error.message
        });
    }
});

// Helper function to generate PDF content using puppeteer
async function generateOrderPDF(orderData, type) {
    const puppeteer = await import('puppeteer');

    const header = `
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 15px;">
            <h1 style="color: #2563eb; margin-bottom: 5px;">ToolLink</h1>
            <h2 style="color: #374151; margin: 0;">${type === 'sub' ? 'Sub-Order Details' : 'Main Order Details'}</h2>
            <p style="color: #6b7280; margin: 5px 0;">Order #${orderData.orderNumber || orderData.subOrderNumber}</p>
        </div>
    `;

    let content = '';
    if (type === 'sub') {
        content = `
            <div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                    <div>
                        <h3 style="color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Sub-Order Information</h3>
                        <p><strong>Sub-Order Number:</strong> ${orderData.subOrderNumber}</p>
                        <p><strong>Material Category:</strong> ${orderData.materialCategory}</p>
                        <p><strong>Warehouse:</strong> ${orderData.warehouseId.name}</p>
                        <p><strong>Status:</strong> <span style="text-transform: capitalize; color: #059669;">${orderData.status.replace(/_/g, ' ')}</span></p>
                    </div>
                    <div>
                        <h3 style="color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Schedule Information</h3>
                        <p><strong>Scheduled Date:</strong> ${new Date(orderData.scheduledAt).toLocaleDateString()}</p>
                        <p><strong>Scheduled Time:</strong> ${orderData.scheduledTime}</p>
                        <p><strong>Estimated Duration:</strong> ${orderData.estimatedDuration} minutes</p>
                        <p><strong>Total Amount:</strong> <span style="color: #dc2626; font-size: 18px;">Rs. ${orderData.totalAmount.toFixed(2)}</span></p>
                    </div>
                </div>

                <h3 style="color: #2563eb; margin-top: 30px;">Items Details</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Material</th>
                            <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">Quantity</th>
                            <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Unit Price</th>
                            <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderData.items.map((item, index) => `
                            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                                <td style="padding: 10px; border: 1px solid #e5e7eb;">${item.materialName}</td>
                                <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb;">${item.qty}</td>
                                <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">Rs. ${item.unitPrice.toFixed(2)}</td>
                                <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb; font-weight: bold;">Rs. ${item.totalPrice.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background-color: #f3f4f6; font-weight: bold;">
                            <td colspan="3" style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Sub-Order Total:</td>
                            <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; color: #dc2626;">Rs. ${orderData.totalAmount.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    } else {
        content = `
            <div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                    <div>
                        <h3 style="color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Order Information</h3>
                        <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
                        <p><strong>Customer:</strong> ${orderData.customerId.username}</p>
                        <p><strong>Email:</strong> ${orderData.customerId.email}</p>
                        <p><strong>Status:</strong> <span style="text-transform: capitalize; color: #059669;">${orderData.status.replace(/_/g, ' ')}</span></p>
                        <p><strong>Order Date:</strong> ${new Date(orderData.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Order Summary</h3>
                        <p><strong>Total Items:</strong> ${orderData.items.length}</p>
                        <p><strong>Requested Delivery:</strong> ${orderData.requestedDeliveryDate ? new Date(orderData.requestedDeliveryDate).toLocaleDateString() : 'ASAP'}</p>
                        <p style="font-size: 20px; color: #dc2626;"><strong>Total Amount: Rs. ${orderData.totalAmount.toFixed(2)}</strong></p>
                    </div>
                </div>

                <h3 style="color: #2563eb; margin-top: 30px;">Items Details</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Material</th>
                            <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Category</th>
                            <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">Quantity</th>
                            <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Unit Price</th>
                            <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderData.items.map((item, index) => `
                            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                                <td style="padding: 10px; border: 1px solid #e5e7eb;">${item.materialId.name}</td>
                                <td style="padding: 10px; border: 1px solid #e5e7eb;">${item.materialId.category}</td>
                                <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb;">${item.requestedQty}</td>
                                <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">Rs. ${item.unitPrice.toFixed(2)}</td>
                                <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb; font-weight: bold;">Rs. ${item.totalPrice.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background-color: #f3f4f6; font-weight: bold;">
                            <td colspan="4" style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Order Total:</td>
                            <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; color: #dc2626;">Rs. ${orderData.totalAmount.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order ${orderData.orderNumber || orderData.subOrderNumber}</title>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 40px;
                    color: #374151;
                    line-height: 1.5;
                }
                h1, h2, h3 { margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 8px; text-align: left; }
                .header { text-align: center; margin-bottom: 30px; }
                @media print {
                    body { margin: 20px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${header}
            ${content}
            <div style="margin-top: 40px; text-align: center; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <p><small>Generated on ${new Date().toLocaleString()}</small></p>
                <p><small>ToolLink - Construction Materials Management System</small></p>
                <p><small>Contact: support@toollink.com | +94 11 123 4567</small></p>
            </div>
        </body>
        </html>
    `;

    try {
        const browser = await puppeteer.default.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        await browser.close();
        return pdfBuffer;
    } catch (error) {
        console.error('PDF generation error:', error);
        // Fallback: return HTML as text
        return Buffer.from(htmlContent, 'utf8');
    }
}

export default router;
