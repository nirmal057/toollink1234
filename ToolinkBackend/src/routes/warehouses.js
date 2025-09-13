import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Warehouse from '../models/Warehouse.js';
import User from '../models/User.js';
import InventoryService from '../services/InventoryService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const warehouseValidation = [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
    body('location.address').trim().isLength({ min: 1 }).withMessage('Address is required'),
    body('location.city').trim().isLength({ min: 1 }).withMessage('City is required'),
    body('location.state').trim().isLength({ min: 1 }).withMessage('State is required'),
    body('location.zipCode').trim().isLength({ min: 1 }).withMessage('Zip code is required'),
    body('managerId').custom(value => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
            throw new Error('Valid manager ID is required');
        }
        return true;
    }),
    body('operatingHours.open').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid opening time format (HH:MM)'),
    body('operatingHours.close').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid closing time format (HH:MM)')
];

// GET /api/warehouses - Get all warehouses
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { active = 'true', include_manager = 'true' } = req.query;
        
        const query = {};
        if (active === 'true') query.isActive = true;

        let warehouses;
        if (include_manager === 'true') {
            warehouses = await Warehouse.find(query)
                .populate('managerId', 'username email fullName')
                .sort({ name: 1 });
        } else {
            warehouses = await Warehouse.find(query).sort({ name: 1 });
        }

        res.json({
            success: true,
            data: { warehouses }
        });
    } catch (error) {
        console.error('Error fetching warehouses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch warehouses'
        });
    }
});

// GET /api/warehouses/:id - Get warehouse by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const warehouse = await Warehouse.findById(req.params.id)
            .populate('managerId', 'username email fullName');
        
        if (!warehouse) {
            return res.status(404).json({
                success: false,
                error: 'Warehouse not found'
            });
        }

        res.json({
            success: true,
            data: { warehouse }
        });
    } catch (error) {
        console.error('Error fetching warehouse:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch warehouse'
        });
    }
});

// GET /api/warehouses/:id/stock - Get stock levels for a warehouse
router.get('/:id/stock', 
    authenticateToken, 
    requireRole(['ADMIN', 'WAREHOUSE_MANAGER']),
    async (req, res) => {
        try {
            const { include_zero = 'false' } = req.query;
            
            const warehouse = await Warehouse.findById(req.params.id);
            if (!warehouse) {
                return res.status(404).json({
                    success: false,
                    error: 'Warehouse not found'
                });
            }

            const stockLevels = await InventoryService.getWarehouseStock(
                req.params.id, 
                include_zero === 'true'
            );

            res.json({
                success: true,
                data: {
                    warehouse: {
                        id: warehouse._id,
                        name: warehouse.name
                    },
                    stockLevels
                }
            });
        } catch (error) {
            console.error('Error fetching warehouse stock:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch warehouse stock'
            });
        }
    }
);

// POST /api/warehouses - Create new warehouse (ADMIN only)
router.post('/', 
    authenticateToken, 
    requireRole(['ADMIN']),
    warehouseValidation,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            // Verify manager exists and has appropriate role
            const manager = await User.findById(req.body.managerId);
            if (!manager) {
                return res.status(400).json({
                    success: false,
                    error: 'Manager not found'
                });
            }

            if (!['ADMIN', 'WAREHOUSE_MANAGER'].includes(manager.role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Manager must have ADMIN or WAREHOUSE_MANAGER role'
                });
            }

            const warehouse = new Warehouse(req.body);
            await warehouse.save();

            // Populate manager info for response
            await warehouse.populate('managerId', 'username email fullName');

            res.status(201).json({
                success: true,
                message: 'Warehouse created successfully',
                data: { warehouse }
            });
        } catch (error) {
            console.error('Error creating warehouse:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create warehouse'
            });
        }
    }
);

// PUT /api/warehouses/:id - Update warehouse (ADMIN only)
router.put('/:id',
    authenticateToken,
    requireRole(['ADMIN']),
    warehouseValidation,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            // Verify manager exists and has appropriate role
            const manager = await User.findById(req.body.managerId);
            if (!manager) {
                return res.status(400).json({
                    success: false,
                    error: 'Manager not found'
                });
            }

            if (!['ADMIN', 'WAREHOUSE_MANAGER'].includes(manager.role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Manager must have ADMIN or WAREHOUSE_MANAGER role'
                });
            }

            const warehouse = await Warehouse.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            ).populate('managerId', 'username email fullName');

            if (!warehouse) {
                return res.status(404).json({
                    success: false,
                    error: 'Warehouse not found'
                });
            }

            res.json({
                success: true,
                message: 'Warehouse updated successfully',
                data: { warehouse }
            });
        } catch (error) {
            console.error('Error updating warehouse:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update warehouse'
            });
        }
    }
);

// DELETE /api/warehouses/:id - Soft delete warehouse (ADMIN only)
router.delete('/:id',
    authenticateToken,
    requireRole(['ADMIN']),
    async (req, res) => {
        try {
            const warehouse = await Warehouse.findByIdAndUpdate(
                req.params.id,
                { isActive: false },
                { new: true }
            );

            if (!warehouse) {
                return res.status(404).json({
                    success: false,
                    error: 'Warehouse not found'
                });
            }

            res.json({
                success: true,
                message: 'Warehouse deactivated successfully',
                data: { warehouse }
            });
        } catch (error) {
            console.error('Error deleting warehouse:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete warehouse'
            });
        }
    }
);

export default router;