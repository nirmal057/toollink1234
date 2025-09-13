import StockLedger from '../models/StockLedger.js';
import Material from '../models/Material.js';
import Warehouse from '../models/Warehouse.js';
import NotificationService from './NotificationService.js';

/**
 * InventoryService - Manages stock operations and tracking
 */
class InventoryService {

    /**
     * Get current stock levels for a warehouse
     */
    static async getWarehouseStock(warehouseId, includeZero = false) {
        const pipeline = [
            { $match: { warehouseId: warehouseId } },
            {
                $group: {
                    _id: '$materialId',
                    currentStock: { $sum: '$quantity' }
                }
            },
            {
                $lookup: {
                    from: 'materials',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'material'
                }
            },
            { $unwind: '$material' },
            {
                $project: {
                    _id: 0,
                    materialId: '$_id',
                    materialName: '$material.name',
                    category: '$material.category',
                    unit: '$material.unit',
                    currentStock: 1
                }
            }
        ];

        if (!includeZero) {
            pipeline.push({ $match: { currentStock: { $gt: 0 } } });
        }

        return await StockLedger.aggregate(pipeline);
    }

    /**
     * Add stock to warehouse (receipt)
     */
    static async addStock(warehouseId, materialId, quantity, unitCost, userId, reference = null) {
        if (quantity <= 0) {
            throw new Error('Quantity must be positive');
        }

        const [warehouse, material] = await Promise.all([
            Warehouse.findById(warehouseId),
            Material.findById(materialId)
        ]);

        if (!warehouse) throw new Error('Warehouse not found');
        if (!material) throw new Error('Material not found');

        const stockEntry = new StockLedger({
            warehouseId,
            materialId,
            quantity,
            unitCost,
            operation: 'RECEIPT',
            reference,
            userId
        });

        await stockEntry.save();

        // Check if we should send low stock alerts
        await this.checkStockThresholds(warehouseId, materialId);

        return stockEntry;
    }

    /**
     * Remove stock from warehouse (issue/dispatch)
     */
    static async removeStock(warehouseId, materialId, quantity, userId, reference = null) {
        if (quantity <= 0) {
            throw new Error('Quantity must be positive');
        }

        const currentStock = await this.getCurrentStock(warehouseId, materialId);
        if (currentStock < quantity) {
            throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
        }

        const stockEntry = new StockLedger({
            warehouseId,
            materialId,
            quantity: -quantity,
            operation: 'ISSUE',
            reference,
            userId
        });

        await stockEntry.save();

        // Check if we need to send low stock alerts
        await this.checkStockThresholds(warehouseId, materialId);

        return stockEntry;
    }

    /**
     * Get current stock for specific material in warehouse
     */
    static async getCurrentStock(warehouseId, materialId) {
        const result = await StockLedger.aggregate([
            { $match: { warehouseId, materialId } },
            { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]);

        return result.length > 0 ? result[0].total : 0;
    }

    /**
     * Transfer stock between warehouses
     */
    static async transferStock(fromWarehouseId, toWarehouseId, materialId, quantity, userId) {
        if (quantity <= 0) {
            throw new Error('Quantity must be positive');
        }

        const currentStock = await this.getCurrentStock(fromWarehouseId, materialId);
        if (currentStock < quantity) {
            throw new Error(`Insufficient stock in source warehouse. Available: ${currentStock}`);
        }

        const transferRef = `TRANSFER-${Date.now()}`;

        // Remove from source warehouse
        await this.removeStock(fromWarehouseId, materialId, quantity, userId, transferRef);

        // Add to destination warehouse
        await this.addStock(toWarehouseId, materialId, quantity, 0, userId, transferRef);

        return transferRef;
    }

    /**
     * Check stock thresholds and send notifications
     */
    static async checkStockThresholds(warehouseId, materialId) {
        const warehouse = await Warehouse.findById(warehouseId);
        if (!warehouse) return;

        const currentStock = await this.getCurrentStock(warehouseId, materialId);
        const minThreshold = warehouse.minStockThresholds.get(materialId.toString());

        if (minThreshold && currentStock <= minThreshold) {
            const material = await Material.findById(materialId);
            
            await NotificationService.createNotification({
                userId: warehouse.managerId,
                type: 'LOW_STOCK',
                title: 'Low Stock Alert',
                message: `${material.name} in ${warehouse.name} is running low (${currentStock} ${material.unit})`
            });
        }
    }

    /**
     * Get stock movements history
     */
    static async getStockHistory(warehouseId, materialId = null, startDate = null, endDate = null) {
        const query = { warehouseId };
        
        if (materialId) query.materialId = materialId;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        return await StockLedger.find(query)
            .populate('materialId', 'name category unit')
            .populate('userId', 'username fullName')
            .sort({ timestamp: -1 });
    }

    /**
     * Get materials below minimum stock threshold across all warehouses
     */
    static async getLowStockItems() {
        const warehouses = await Warehouse.find({ isActive: true });
        const lowStockItems = [];

        for (const warehouse of warehouses) {
            for (const [materialId, minThreshold] of warehouse.minStockThresholds) {
                const currentStock = await this.getCurrentStock(warehouse._id, materialId);
                
                if (currentStock <= minThreshold) {
                    const material = await Material.findById(materialId);
                    lowStockItems.push({
                        warehouse: {
                            id: warehouse._id,
                            name: warehouse.name
                        },
                        material: {
                            id: material._id,
                            name: material.name,
                            category: material.category,
                            unit: material.unit
                        },
                        currentStock,
                        minThreshold
                    });
                }
            }
        }

        return lowStockItems;
    }
}

export default InventoryService;