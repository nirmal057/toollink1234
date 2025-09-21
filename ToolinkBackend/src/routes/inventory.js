import express from 'express';
import { body, validationResult } from 'express-validator';
import Inventory from '../models/Inventory.js';
import { authorize, authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// User to warehouse mapping
const userWarehouseMap = {
    'house1@toollink.com': 'warehouse1',  // River sand/soil
    'house2@toollink.com': 'warehouse2',  // Bricks
    'house3@toollink.com': 'warehouse3',  // Metals
    'main_house@toollink.com': 'main_warehouse' // Tools & Equipment
};

// Validation rules
const inventoryValidation = [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be less than 100 characters'),
    body('category').isIn([
        'Cement', 'Steel & Reinforcement', 'Paint & Chemicals', 'Electrical Items', 'Plumbing Supplies',
        'Tools & Equipment', 'Hardware & Fasteners', 'Tiles & Ceramics', 'Roofing Materials',
        'Safety Equipment', 'Sand & Aggregate', 'Bricks', 'Masonry Blocks', 'Stones', 'Materials'
    ]).withMessage('Invalid category'),
    body('warehouse').isIn(['warehouse1', 'warehouse2', 'warehouse3', 'main_warehouse']).withMessage('Invalid warehouse'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('unit').isIn(['pieces', 'kg', 'liters', 'meters', 'boxes', 'sets', 'pairs', 'rolls', 'sheets', 'units']).withMessage('Invalid unit'),
    body('threshold').isInt({ min: 0 }).withMessage('Threshold must be a non-negative integer'),
    body('location').trim().isLength({ min: 1 }).withMessage('Location is required')
];

// Get all inventory items with warehouse filtering
router.get('/', authenticateToken, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category,
            location,
            status = 'active',
            lowStock = false,
            search = '',
            sort = 'name'
        } = req.query;

        // Determine warehouse filter based on user
        let warehouseFilter = null;

        if (req.user.role !== 'admin') {
            warehouseFilter = userWarehouseMap[req.user.email];

            // If warehouse user not found in map, deny access
            if (req.user.role === 'warehouse' && !warehouseFilter) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: Warehouse not assigned',
                    errorType: 'WAREHOUSE_ACCESS_DENIED'
                });
            }
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            category,
            location,
            status,
            lowStock: lowStock === 'true',
            sort,
            warehouse: warehouseFilter // Add warehouse filter
        };

        const result = await Inventory.searchInventory(search, options);

        res.json({
            success: true,
            data: result,
            items: result.items,
            warehouse: warehouseFilter, // Include warehouse info in response
            pagination: {
                page: result.page,
                pages: result.pages,
                total: result.total,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        logger.error('Get inventory error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory',
            errorType: 'FETCH_INVENTORY_ERROR'
        });
    }
});

// Get inventory statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        // Get user information from auth middleware
        const userEmail = req.user?.email;
        const userRole = req.user?.role;

        // Determine warehouse filter based on user
        let warehouseFilter = {};
        if (userRole === 'warehouse' && userEmail) {
            const userWarehouse = userWarehouseMap[userEmail];
            if (userWarehouse) {
                warehouseFilter = { warehouse: userWarehouse };
            }
        }
        // Admin users see all warehouses (no filter)

        console.log('User:', userEmail, 'Role:', userRole, 'Warehouse Filter:', warehouseFilter);

        const stats = await Inventory.getStatistics(warehouseFilter);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Get inventory statistics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory statistics',
            errorType: 'FETCH_STATS_ERROR'
        });
    }
});

// Get low stock items
router.get('/low-stock', async (req, res) => {
    try {
        const items = await Inventory.getLowStockItems();

        res.json({
            success: true,
            data: items,
            count: items.length
        });
    } catch (error) {
        logger.error('Get low stock items error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch low stock items',
            errorType: 'FETCH_LOW_STOCK_ERROR'
        });
    }
});

// Get single inventory item
router.get('/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id)
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email');

        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Inventory item not found',
                errorType: 'ITEM_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        logger.error('Get inventory item error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory item',
            errorType: 'FETCH_ITEM_ERROR'
        });
    }
});

// Create inventory item
router.post('/', authenticateToken, authorize('admin', 'warehouse'), inventoryValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const itemData = {
            ...req.body,
            created_by: req.user._id,
            current_stock: req.body.quantity,
            min_stock_level: req.body.threshold
        };

        const item = new Inventory(itemData);
        await item.save();

        // Populate creator info
        await item.populate('created_by', 'fullName email');

        logger.info(`Inventory item created: ${item.name} by ${req.user.fullName}`);

        res.status(201).json({
            success: true,
            message: 'Inventory item created successfully',
            data: item
        });
    } catch (error) {
        logger.error('Create inventory item error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'SKU already exists',
                errorType: 'DUPLICATE_SKU'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create inventory item',
            errorType: 'CREATE_ITEM_ERROR'
        });
    }
});

// Update inventory item
router.put('/:id', authenticateToken, authorize('admin', 'warehouse'), async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Inventory item not found',
                errorType: 'ITEM_NOT_FOUND'
            });
        }

        // Update fields
        Object.keys(req.body).forEach(key => {
            if (key !== '_id' && key !== 'created_by' && key !== 'created_at') {
                item[key] = req.body[key];
            }
        });

        item.updated_by = req.user._id;

        // If quantity is updated, sync with current_stock
        if (req.body.quantity !== undefined) {
            item.current_stock = req.body.quantity;
        }

        await item.save();

        // Populate updated info
        await item.populate('created_by', 'fullName email');
        await item.populate('updated_by', 'fullName email');

        logger.info(`Inventory item updated: ${item.name} by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Inventory item updated successfully',
            data: item
        });
    } catch (error) {
        logger.error('Update inventory item error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update inventory item',
            errorType: 'UPDATE_ITEM_ERROR'
        });
    }
});

// Update item quantity
router.patch('/:id/quantity', authorize('admin', 'warehouse'), async (req, res) => {
    try {
        const { quantity, action = 'set', notes } = req.body;

        if (typeof quantity !== 'number' || quantity < 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid quantity value',
                errorType: 'INVALID_QUANTITY'
            });
        }

        const item = await Inventory.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Inventory item not found',
                errorType: 'ITEM_NOT_FOUND'
            });
        }

        const previousQuantity = item.current_stock;

        // Update quantity based on action
        switch (action) {
            case 'add':
                item.current_stock += quantity;
                break;
            case 'subtract':
                item.current_stock = Math.max(0, item.current_stock - quantity);
                break;
            case 'set':
            default:
                item.current_stock = quantity;
                break;
        }

        // Sync with quantity field
        item.quantity = item.current_stock;
        item.updated_by = req.user._id;

        if (notes) {
            item.notes = notes;
        }

        await item.save();

        logger.info(`Inventory quantity updated: ${item.name} from ${previousQuantity} to ${item.current_stock} by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Inventory quantity updated successfully',
            data: {
                id: item._id,
                name: item.name,
                previousQuantity,
                currentQuantity: item.current_stock,
                action,
                updatedBy: req.user.fullName,
                updatedAt: item.updated_at
            }
        });
    } catch (error) {
        logger.error('Update inventory quantity error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update inventory quantity',
            errorType: 'UPDATE_QUANTITY_ERROR'
        });
    }
});

// Delete inventory item (permanent deletion)
router.delete('/:id', authenticateToken, authorize('admin', 'warehouse'), async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Inventory item not found',
                errorType: 'ITEM_NOT_FOUND'
            });
        }

        // Store item details before deletion
        const deletedItem = {
            id: item._id,
            name: item.name,
            sku: item.sku,
            category: item.category,
            deletedBy: req.user.fullName,
            deletedAt: new Date()
        };

        // Permanent delete from database
        await Inventory.findByIdAndDelete(req.params.id);

        logger.info(`Inventory item permanently deleted: ${item.name} (SKU: ${item.sku}) by ${req.user.fullName}`);

        res.json({
            success: true,
            message: 'Inventory item permanently deleted from database',
            data: deletedItem
        });
    } catch (error) {
        logger.error('Delete inventory item error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete inventory item',
            errorType: 'DELETE_ITEM_ERROR',
            details: error.message
        });
    }
});

// Get inventory categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Inventory.distinct('category', {
            status: 'active'
        });

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        logger.error('Get inventory categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory categories',
            errorType: 'FETCH_CATEGORIES_ERROR'
        });
    }
});

// Get inventory locations
router.get('/locations', async (req, res) => {
    try {
        const locations = await Inventory.distinct('location', {
            status: 'active'
        });

        res.json({
            success: true,
            data: locations
        });
    } catch (error) {
        logger.error('Get inventory locations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory locations',
            errorType: 'FETCH_LOCATIONS_ERROR'
        });
    }
});

// Bulk operations
router.post('/bulk', authenticateToken, authorize('admin', 'warehouse'), async (req, res) => {
    try {
        const { operation, items } = req.body;

        if (!operation || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bulk operation data',
                errorType: 'INVALID_BULK_DATA'
            });
        }

        const results = [];

        for (const itemData of items) {
            try {
                let result;

                switch (operation) {
                    case 'create':
                        const newItem = new Inventory({
                            ...itemData,
                            created_by: req.user._id,
                            current_stock: itemData.quantity,
                            min_stock_level: itemData.threshold
                        });
                        result = await newItem.save();
                        break;

                    case 'update':
                        result = await Inventory.findByIdAndUpdate(
                            itemData.id,
                            { ...itemData, updated_by: req.user._id },
                            { new: true }
                        );
                        break;

                    case 'delete':
                        result = await Inventory.findByIdAndUpdate(
                            itemData.id,
                            { deletedAt: new Date(), updated_by: req.user._id },
                            { new: true }
                        );
                        break;

                    default:
                        throw new Error(`Unknown operation: ${operation}`);
                }

                results.push({ success: true, data: result });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }

        logger.info(`Bulk inventory operation ${operation} performed by ${req.user.fullName}`);

        res.json({
            success: true,
            message: `Bulk ${operation} operation completed`,
            results,
            summary: {
                total: items.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        });
    } catch (error) {
        logger.error('Bulk inventory operation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform bulk operation',
            errorType: 'BULK_OPERATION_ERROR'
        });
    }
});

export default router;
