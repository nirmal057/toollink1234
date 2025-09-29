// Enhanced Order Routes with Warehouse-Category ID System
// This adds specific routes for the new hierarchical order system

import express from 'express';
import MainOrder from '../models/MainOrder.js';
import SubOrder from '../models/SubOrder.js';
import Inventory from '../models/Inventory.js';
import { authorize, authenticateToken } from '../middleware/auth.js';
import OrderIdManager from '../config/orderIdManager.js';
import { WarehouseCategoryUtils } from '../config/warehouseCategories.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// 🆕 GET WAREHOUSE-SPECIFIC SUB-ORDERS
// Warehouse users see only their relevant sub-orders
router.get('/warehouse/:warehouseCode/sub-orders', authorize('warehouse', 'admin'), async (req, res) => {
    try {
        const { warehouseCode } = req.params;
        const { page = 1, limit = 10, status, search = '' } = req.query;

        // Validate warehouse code
        if (!['W1', 'W2', 'W3', 'WM'].includes(warehouseCode)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid warehouse code',
                errorType: 'INVALID_WAREHOUSE'
            });
        }

        // Build filter
        const filter = { warehouseCode };
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { subOrderNumber: { $regex: search, $options: 'i' } },
                { mainOrderNumber: { $regex: search, $options: 'i' } },
                { 'items.materialName': { $regex: search, $options: 'i' } }
            ];
        }

        // Get sub-orders with pagination
        const subOrders = await SubOrder.find(filter)
            .populate('mainOrderId', 'orderNumber customerId deliveryAddress totalAmount')
            .populate('mainOrderId.customerId', 'fullName email phone')
            .populate('items.materialId', 'name category unit sku')
            .populate('items.inventoryItemId', 'name categoryId current_stock')
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await SubOrder.countDocuments(filter);

        // Add warehouse info and format response
        const warehouseInfo = WarehouseCategoryUtils.getWarehouseInfo(warehouseCode);

        res.json({
            success: true,
            data: {
                warehouse: {
                    code: warehouseCode,
                    name: warehouseInfo?.name || `Warehouse ${warehouseCode}`,
                    description: warehouseInfo?.description
                },
                subOrders: subOrders.map(subOrder => ({
                    ...subOrder.toObject(),
                    orderHierarchy: {
                        mainOrderId: subOrder.mainOrderNumber,
                        subOrderId: subOrder.subOrderNumber,
                        warehouseCode: subOrder.warehouseCode
                    }
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        logger.error('Get warehouse sub-orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch warehouse sub-orders',
            errorType: 'FETCH_SUB_ORDERS_ERROR'
        });
    }
});

// 🆕 GET FULL ORDER VIEW FOR ADMIN
// Admin sees complete order with all sub-orders and warehouse breakdown
router.get('/admin/full-order/:mainOrderId', authorize('admin', 'cashier'), async (req, res) => {
    try {
        const { mainOrderId } = req.params;

        // Validate main order ID format
        if (!OrderIdManager.validateOrderId(mainOrderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid main order ID format',
                errorType: 'INVALID_ORDER_ID'
            });
        }

        // Get main order
        const mainOrder = await MainOrder.findOne({ orderNumber: mainOrderId })
            .populate('customerId', 'fullName email phone address')
            .populate('items.materialId', 'name category unit sku sellingPrice')
            .populate('createdBy', 'fullName role');

        if (!mainOrder) {
            return res.status(404).json({
                success: false,
                error: 'Main order not found',
                errorType: 'ORDER_NOT_FOUND'
            });
        }

        // Get all related sub-orders
        const subOrders = await SubOrder.find({ mainOrderNumber: mainOrderId })
            .populate('warehouseId', 'name location contact')
            .populate('items.materialId', 'name category unit sku')
            .populate('items.inventoryItemId', 'name categoryId current_stock supplier_info')
            .sort('warehouseCode');

        // Build complete order tracking info
        const trackingInfo = OrderIdManager.createOrderTrackingInfo(mainOrderId, subOrders);

        // Get warehouse breakdown with category details
        const warehouseBreakdown = {};
        for (const subOrder of subOrders) {
            const warehouseCode = subOrder.warehouseCode;
            const warehouseInfo = WarehouseCategoryUtils.getWarehouseInfo(warehouseCode);

            warehouseBreakdown[warehouseCode] = {
                warehouse: warehouseInfo,
                subOrder: {
                    ...subOrder.toObject(),
                    itemsWithCategories: subOrder.items.map(item => ({
                        ...item.toObject(),
                        categoryDetails: item.categoryId ?
                            WarehouseCategoryUtils.getCategoryById(item.categoryId) : null
                    }))
                }
            };
        }

        res.json({
            success: true,
            data: {
                mainOrder,
                trackingInfo,
                warehouseBreakdown,
                summary: {
                    totalSubOrders: subOrders.length,
                    warehousesInvolved: Object.keys(warehouseBreakdown),
                    totalItems: subOrders.reduce((sum, so) => sum + so.items.length, 0),
                    orderType: mainOrder.orderType || 'single-warehouse'
                }
            }
        });

    } catch (error) {
        logger.error('Get full order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch full order details',
            errorType: 'FETCH_ORDER_ERROR'
        });
    }
});

// 🆕 APPROVE ORDER BY CASHIER/ADMIN AND AUTO-CATEGORIZE TO INVENTORY
router.post('/approve/:mainOrderId', authorize('admin', 'cashier'), async (req, res) => {
    try {
        const { mainOrderId } = req.params;
        const { notes } = req.body;

        // Validate main order ID format
        if (!OrderIdManager.validateOrderId(mainOrderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid main order ID format',
                errorType: 'INVALID_ORDER_ID'
            });
        }

        // Get main order and sub-orders
        const mainOrder = await MainOrder.findOne({ orderNumber: mainOrderId });
        if (!mainOrder) {
            return res.status(404).json({
                success: false,
                error: 'Main order not found',
                errorType: 'ORDER_NOT_FOUND'
            });
        }

        const subOrders = await SubOrder.find({ mainOrderNumber: mainOrderId });

        // 🆕 AUTO-ALLOCATE INVENTORY BASED ON CATEGORY IDs
        const allocationResults = [];

        for (const subOrder of subOrders) {
            for (const item of subOrder.items) {
                if (item.categoryId) {
                    // Find available inventory items matching the category
                    const availableInventory = await Inventory.find({
                        categoryId: item.categoryId,
                        current_stock: { $gte: item.qty },
                        status: 'active'
                    }).sort('-current_stock');

                    if (availableInventory.length > 0) {
                        const inventoryItem = availableInventory[0];

                        // Link inventory item to sub-order item
                        item.inventoryItemId = inventoryItem._id;

                        // Reserve the stock (don't deduct yet, just mark as allocated)
                        inventoryItem.allocated_stock = (inventoryItem.allocated_stock || 0) + item.qty;
                        await inventoryItem.save();

                        allocationResults.push({
                            subOrderId: subOrder.subOrderNumber,
                            itemName: item.materialName,
                            categoryId: item.categoryId,
                            allocatedFrom: inventoryItem.name,
                            allocatedQuantity: item.qty
                        });
                    } else {
                        allocationResults.push({
                            subOrderId: subOrder.subOrderNumber,
                            itemName: item.materialName,
                            categoryId: item.categoryId,
                            status: 'insufficient_stock',
                            message: `Insufficient stock for ${item.materialName} (Category: ${item.categoryId})`
                        });
                    }
                }
            }

            // Update sub-order status
            subOrder.status = 'approved';
            subOrder.approvedBy = req.user._id;
            subOrder.approvedAt = new Date();
            subOrder.notes = notes;
            await subOrder.save();
        }

        // Update main order status
        mainOrder.status = 'approved';
        mainOrder.approvedBy = req.user._id;
        mainOrder.approvedAt = new Date();
        await mainOrder.save();

        logger.info(`Order ${mainOrderId} approved by ${req.user.fullName} with inventory auto-allocation`);

        res.json({
            success: true,
            message: 'Order approved and inventory allocated successfully',
            data: {
                mainOrderId,
                status: 'approved',
                allocationResults,
                subOrdersUpdated: subOrders.length
            }
        });

    } catch (error) {
        logger.error('Approve order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve order',
            errorType: 'APPROVE_ORDER_ERROR'
        });
    }
});

export default router;
