import express from 'express';
import { body, validationResult } from 'express-validator';
import Material from '../models/Material.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const materialValidation = [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be max 500 characters'),
    body('category').isIn([
        'Cement', 'Steel & Reinforcement', 'Aggregates', 'Bricks & Blocks',
        'Roofing Materials', 'Electrical', 'Plumbing', 'Paint & Chemicals',
        'Tools & Equipment', 'Safety Equipment', 'Hardware & Fasteners', 'Other'
    ]).withMessage('Invalid category'),
    body('unit').isIn(['kg', 'ton', 'bag', 'piece']).withMessage('Invalid unit'),
    body('sku').optional().trim().isLength({ max: 50 }).withMessage('SKU must be max 50 characters'),
    body('costPrice').optional().isNumeric().isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
    body('sellingPrice').optional().isNumeric().isFloat({ min: 0 }).withMessage('Selling price must be a positive number')
];

// GET /api/materials - Get all materials
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { category, search, page = 1, limit = 50, active = 'true' } = req.query;

        const query = {};
        if (active === 'true') query.isActive = true;
        if (category && category !== 'all') query.category = category;

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const [materials, total] = await Promise.all([
            Material.find(query)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limitNum),
            Material.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                materials,
                pagination: {
                    current: pageNum,
                    pages: Math.ceil(total / limitNum),
                    total,
                    limit: limitNum
                }
            }
        });
    } catch (error) {
        console.error('Error fetching materials:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch materials'
        });
    }
});

// GET /api/materials/categories - Get all categories
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const categories = [
            'Cement', 'Steel & Reinforcement', 'Aggregates', 'Bricks & Blocks',
            'Roofing Materials', 'Electrical', 'Plumbing', 'Paint & Chemicals',
            'Tools & Equipment', 'Safety Equipment', 'Hardware & Fasteners', 'Other'
        ];

        res.json({
            success: true,
            data: { categories }
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});

// GET /api/materials/:id - Get material by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);

        if (!material) {
            return res.status(404).json({
                success: false,
                error: 'Material not found'
            });
        }

        res.json({
            success: true,
            data: { material }
        });
    } catch (error) {
        console.error('Error fetching material:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch material'
        });
    }
});

// POST /api/materials - Create new material (admin, warehouse, editor)
router.post('/',
    authenticateToken,
    requireRole(['admin', 'warehouse', 'editor']),
    materialValidation,
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

            // Check for duplicate SKU if provided
            if (req.body.sku) {
                const existingSku = await Material.findOne({
                    sku: req.body.sku.toUpperCase(),
                    _id: { $ne: req.params.id }
                });
                if (existingSku) {
                    return res.status(400).json({
                        success: false,
                        error: 'SKU already exists'
                    });
                }
            }

            const material = new Material(req.body);
            await material.save();

            res.status(201).json({
                success: true,
                message: 'Material created successfully',
                data: { material }
            });
        } catch (error) {
            console.error('Error creating material:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create material'
            });
        }
    }
);

// PUT /api/materials/:id - Update material (admin, warehouse, editor)
router.put('/:id',
    authenticateToken,
    requireRole(['admin', 'warehouse', 'editor']),
    materialValidation,
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

            // Check for duplicate SKU if provided
            if (req.body.sku) {
                const existingSku = await Material.findOne({
                    sku: req.body.sku.toUpperCase(),
                    _id: { $ne: req.params.id }
                });
                if (existingSku) {
                    return res.status(400).json({
                        success: false,
                        error: 'SKU already exists'
                    });
                }
            }

            const material = await Material.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );

            if (!material) {
                return res.status(404).json({
                    success: false,
                    error: 'Material not found'
                });
            }

            res.json({
                success: true,
                message: 'Material updated successfully',
                data: { material }
            });
        } catch (error) {
            console.error('Error updating material:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update material'
            });
        }
    }
);

// DELETE /api/materials/:id - Soft delete material (admin only)
router.delete('/:id',
    authenticateToken,
    requireRole(['admin']),
    async (req, res) => {
        try {
            const material = await Material.findByIdAndUpdate(
                req.params.id,
                { isActive: false },
                { new: true }
            );

            if (!material) {
                return res.status(404).json({
                    success: false,
                    error: 'Material not found'
                });
            }

            res.json({
                success: true,
                message: 'Material deactivated successfully',
                data: { material }
            });
        } catch (error) {
            console.error('Error deleting material:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete material'
            });
        }
    }
);

export default router;
