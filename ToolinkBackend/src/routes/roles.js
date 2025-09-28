import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import RoleBasedService from '../services/RoleBasedService.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ============================================================================
// ADMIN ROUTES - Full system access
// ============================================================================

// Admin Dashboard
router.get('/admin/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const dashboard = await RoleBasedService.getAdminDashboard(req.user.userId);
        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        logger.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load admin dashboard',
            error: error.message
        });
    }
});

// User Management
router.post('/admin/users/:action', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { action } = req.params;
        const result = await RoleBasedService.manageUsers(req.user.userId, action, req.body);
        res.json({
            success: true,
            data: result,
            message: `User ${action} completed successfully`
        });
    } catch (error) {
        logger.error('User management error:', error);
        res.status(500).json({
            success: false,
            message: `Failed to ${req.params.action} user`,
            error: error.message
        });
    }
});

// System Reports
router.post('/admin/reports/:reportType', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { reportType } = req.params;
        const report = await RoleBasedService.generateSystemReports(
            req.user.userId,
            reportType,
            req.body.filters
        );
        res.json({
            success: true,
            data: report,
            message: 'Report generated successfully'
        });
    } catch (error) {
        logger.error('Report generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            error: error.message
        });
    }
});

// ============================================================================
// WAREHOUSE ROUTES - Warehouse management
// ============================================================================

// Warehouse Dashboard
router.get('/warehouse/dashboard', authenticateToken, requireRole(['warehouse', 'admin']), async (req, res) => {
    try {
        const dashboard = await RoleBasedService.getWarehouseDashboard(req.user.userId);
        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        logger.error('Warehouse dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load warehouse dashboard',
            error: error.message
        });
    }
});

// Inventory Management
router.post('/warehouse/inventory/:action', authenticateToken, requireRole(['warehouse', 'admin']), async (req, res) => {
    try {
        const { action } = req.params;
        const result = await RoleBasedService.manageInventory(req.user.userId, action, req.body);
        res.json({
            success: true,
            data: result,
            message: `Inventory ${action} completed successfully`
        });
    } catch (error) {
        logger.error('Inventory management error:', error);
        res.status(500).json({
            success: false,
            message: `Failed to ${req.params.action} inventory`,
            error: error.message
        });
    }
});

// Order Processing
router.put('/warehouse/orders/:orderId/:action', authenticateToken, requireRole(['warehouse', 'admin']), async (req, res) => {
    try {
        const { orderId, action } = req.params;
        const result = await RoleBasedService.processWarehouseOrders(req.user.userId, orderId, action);
        res.json({
            success: true,
            data: result,
            message: `Order ${action} completed successfully`
        });
    } catch (error) {
        logger.error('Order processing error:', error);
        res.status(500).json({
            success: false,
            message: `Failed to ${req.params.action} order`,
            error: error.message
        });
    }
});

// ============================================================================
// CASHIER ROUTES - Point of sale operations
// ============================================================================

// Cashier Dashboard
router.get('/cashier/dashboard', authenticateToken, requireRole(['cashier', 'admin']), async (req, res) => {
    try {
        const dashboard = await RoleBasedService.getCashierDashboard(req.user.userId);
        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        logger.error('Cashier dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load cashier dashboard',
            error: error.message
        });
    }
});

// Payment Processing
router.post('/cashier/payments/:orderId', authenticateToken, requireRole(['cashier', 'admin']), async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await RoleBasedService.processPayment(req.user.userId, orderId, req.body);
        res.json({
            success: true,
            data: result,
            message: 'Payment processed successfully'
        });
    } catch (error) {
        logger.error('Payment processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: error.message
        });
    }
});

// Receipt Generation
router.get('/cashier/receipt/:orderId', authenticateToken, requireRole(['cashier', 'admin']), async (req, res) => {
    try {
        const { orderId } = req.params;
        const receipt = await RoleBasedService.generateReceipt(req.user.userId, orderId);
        res.json({
            success: true,
            data: receipt
        });
    } catch (error) {
        logger.error('Receipt generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate receipt',
            error: error.message
        });
    }
});

// ============================================================================
// CUSTOMER ROUTES - Customer operations
// ============================================================================

// Customer Dashboard
router.get('/customer/dashboard', authenticateToken, requireRole(['customer', 'user']), async (req, res) => {
    try {
        const dashboard = await RoleBasedService.getCustomerDashboard(req.user.userId);
        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        logger.error('Customer dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load customer dashboard',
            error: error.message
        });
    }
});

// Order Tracking
router.get('/customer/orders/:orderId/track', authenticateToken, requireRole(['customer', 'user']), async (req, res) => {
    try {
        const { orderId } = req.params;
        const tracking = await RoleBasedService.trackOrder(req.user.userId, orderId);
        res.json({
            success: true,
            data: tracking
        });
    } catch (error) {
        logger.error('Order tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track order',
            error: error.message
        });
    }
});

// Feedback Submission
router.post('/customer/feedback', authenticateToken, requireRole(['customer', 'user']), async (req, res) => {
    try {
        const feedback = await RoleBasedService.submitFeedback(req.user.userId, req.body);
        res.json({
            success: true,
            data: feedback,
            message: 'Feedback submitted successfully'
        });
    } catch (error) {
        logger.error('Feedback submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback',
            error: error.message
        });
    }
});

// ============================================================================
// DRIVER ROUTES - Delivery operations
// ============================================================================

// Driver Dashboard
router.get('/driver/dashboard', authenticateToken, requireRole(['driver', 'admin']), async (req, res) => {
    try {
        const dashboard = await RoleBasedService.getDriverDashboard(req.user.userId);
        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        logger.error('Driver dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load driver dashboard',
            error: error.message
        });
    }
});

// Update Delivery Status
router.put('/driver/deliveries/:deliveryId/status', authenticateToken, requireRole(['driver', 'admin']), async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const { status, location } = req.body;
        const result = await RoleBasedService.updateDeliveryStatus(
            req.user.userId,
            deliveryId,
            status,
            location
        );
        res.json({
            success: true,
            data: result,
            message: 'Delivery status updated successfully'
        });
    } catch (error) {
        logger.error('Delivery status update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update delivery status',
            error: error.message
        });
    }
});

// Submit Delivery Proof
router.post('/driver/deliveries/:deliveryId/proof', authenticateToken, requireRole(['driver', 'admin']), async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const result = await RoleBasedService.submitDeliveryProof(req.user.userId, deliveryId, req.body);
        res.json({
            success: true,
            data: result,
            message: 'Delivery proof submitted successfully'
        });
    } catch (error) {
        logger.error('Delivery proof submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit delivery proof',
            error: error.message
        });
    }
});

// ============================================================================
// EDITOR ROUTES - Content management
// ============================================================================

// Editor Dashboard
router.get('/editor/dashboard', authenticateToken, requireRole(['editor', 'admin']), async (req, res) => {
    try {
        const dashboard = await RoleBasedService.getEditorDashboard(req.user.userId);
        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        logger.error('Editor dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load editor dashboard',
            error: error.message
        });
    }
});

// Content Management
router.post('/editor/content/:action', authenticateToken, requireRole(['editor', 'admin']), async (req, res) => {
    try {
        const { action } = req.params;
        const result = await RoleBasedService.manageContent(req.user.userId, action, req.body);
        res.json({
            success: true,
            data: result,
            message: `Content ${action} completed successfully`
        });
    } catch (error) {
        logger.error('Content management error:', error);
        res.status(500).json({
            success: false,
            message: `Failed to ${req.params.action} content`,
            error: error.message
        });
    }
});

// ============================================================================
// COMMON ROUTES - Accessible by multiple roles
// ============================================================================

// Get User Profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .populate('assignedWarehouses primaryWarehouse')
            .select('-password');

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
});

// Update Profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const allowedUpdates = ['fullName', 'email', 'phone', 'preferences'];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            updates,
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            data: user,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        logger.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

export default router;
