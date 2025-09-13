import StockLedger from '../models/StockLedger.js';
import Material from '../models/Material.js';
import Warehouse from '../models/Warehouse.js';
import MainOrder from '../models/MainOrder.js';
import SubOrder from '../models/SubOrder.js';

/**
 * PredictionService - Provides demand forecasting and analytics
 */
class PredictionService {

    /**
     * Predict demand for a material in a specific warehouse
     */
    static async predictDemand(warehouseId, materialId, days = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get historical consumption data
        const consumption = await StockLedger.aggregate([
            {
                $match: {
                    warehouseId: warehouseId,
                    materialId: materialId,
                    operation: 'ISSUE',
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    dailyConsumption: { $sum: { $abs: '$quantity' } }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        if (consumption.length === 0) {
            return {
                predictedDailyDemand: 0,
                predictedWeeklyDemand: 0,
                predictedMonthlyDemand: 0,
                confidence: 'LOW',
                message: 'Insufficient historical data'
            };
        }

        // Calculate average daily consumption
        const totalConsumption = consumption.reduce((sum, day) => sum + day.dailyConsumption, 0);
        const avgDailyConsumption = totalConsumption / consumption.length;

        // Simple trend analysis
        const recentDays = consumption.slice(-7); // Last 7 days
        const recentAvg = recentDays.length > 0
            ? recentDays.reduce((sum, day) => sum + day.dailyConsumption, 0) / recentDays.length
            : avgDailyConsumption;

        // Trend factor
        const trendFactor = recentAvg / avgDailyConsumption;
        const adjustedDailyDemand = avgDailyConsumption * trendFactor;

        return {
            predictedDailyDemand: Math.round(adjustedDailyDemand * 100) / 100,
            predictedWeeklyDemand: Math.round(adjustedDailyDemand * 7 * 100) / 100,
            predictedMonthlyDemand: Math.round(adjustedDailyDemand * 30 * 100) / 100,
            confidence: consumption.length >= 14 ? 'HIGH' : consumption.length >= 7 ? 'MEDIUM' : 'LOW',
            historicalDays: consumption.length,
            trend: trendFactor > 1.1 ? 'INCREASING' : trendFactor < 0.9 ? 'DECREASING' : 'STABLE'
        };
    }

    /**
     * Get reorder recommendations for all materials in a warehouse
     */
    static async getReorderRecommendations(warehouseId) {
        const warehouse = await Warehouse.findById(warehouseId);
        if (!warehouse) throw new Error('Warehouse not found');

        const recommendations = [];

        // Get all materials with stock in this warehouse
        const stockSummary = await StockLedger.aggregate([
            { $match: { warehouseId: warehouseId } },
            {
                $group: {
                    _id: '$materialId',
                    currentStock: { $sum: '$quantity' }
                }
            }
        ]);

        for (const stock of stockSummary) {
            const materialId = stock._id;
            const currentStock = stock.currentStock;

            const material = await Material.findById(materialId);
            if (!material) continue;

            const minThreshold = warehouse.minStockThresholds.get(materialId.toString()) || 0;
            const prediction = await this.predictDemand(warehouseId, materialId, 30);

            // Calculate days until stockout
            const daysUntilStockout = prediction.predictedDailyDemand > 0
                ? Math.floor(currentStock / prediction.predictedDailyDemand)
                : 999;

            // Recommend reorder if stock is below threshold or will run out soon
            const shouldReorder = currentStock <= minThreshold || daysUntilStockout <= 7;

            if (shouldReorder) {
                // Calculate suggested order quantity (30 days supply)
                const suggestedQuantity = Math.max(
                    prediction.predictedMonthlyDemand,
                    minThreshold * 2
                );

                recommendations.push({
                    material: {
                        id: material._id,
                        name: material.name,
                        category: material.category,
                        unit: material.unit
                    },
                    currentStock,
                    minThreshold,
                    daysUntilStockout,
                    suggestedQuantity: Math.ceil(suggestedQuantity),
                    prediction,
                    priority: daysUntilStockout <= 3 ? 'URGENT' : daysUntilStockout <= 7 ? 'HIGH' : 'MEDIUM'
                });
            }
        }

        // Sort by priority and days until stockout
        recommendations.sort((a, b) => {
            const priorityOrder = { URGENT: 3, HIGH: 2, MEDIUM: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return a.daysUntilStockout - b.daysUntilStockout;
        });

        return recommendations;
    }

    /**
     * Get popular materials based on order frequency
     */
    static async getPopularMaterials(warehouseId = null, days = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const matchStage = {
            timestamp: { $gte: startDate, $lte: endDate }
        };

        if (warehouseId) {
            matchStage.warehouseId = warehouseId;
        }

        const popularMaterials = await StockLedger.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$materialId',
                    totalQuantity: { $sum: { $abs: '$quantity' } },
                    orderCount: { $sum: 1 }
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
                    totalQuantity: 1,
                    orderCount: 1,
                    avgQuantityPerOrder: { $divide: ['$totalQuantity', '$orderCount'] }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 20 }
        ]);

        return popularMaterials;
    }

    /**
     * Get sales analytics for a period
     */
    static async getSalesAnalytics(warehouseId = null, startDate, endDate) {
        const matchStage = {
            timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
            operation: 'ISSUE'
        };

        if (warehouseId) {
            matchStage.warehouseId = warehouseId;
        }

        const analytics = await StockLedger.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    dailyQuantity: { $sum: { $abs: '$quantity' } },
                    dailyValue: { $sum: { $multiply: [{ $abs: '$quantity' }, '$unitCost'] } }
                }
            },
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: '$dailyQuantity' },
                    totalValue: { $sum: '$dailyValue' },
                    avgDailyQuantity: { $avg: '$dailyQuantity' },
                    avgDailyValue: { $avg: '$dailyValue' },
                    activeDays: { $sum: 1 }
                }
            }
        ]);

        return analytics.length > 0 ? analytics[0] : {
            totalQuantity: 0,
            totalValue: 0,
            avgDailyQuantity: 0,
            avgDailyValue: 0,
            activeDays: 0
        };
    }

    /**
     * Get inventory turnover ratio for materials
     */
    static async getInventoryTurnover(warehouseId, materialId = null, days = 90) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const matchStage = {
            warehouseId: warehouseId,
            timestamp: { $gte: startDate, $lte: endDate }
        };

        if (materialId) {
            matchStage.materialId = materialId;
        }

        const turnoverData = await StockLedger.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$materialId',
                    totalIssued: {
                        $sum: {
                            $cond: [
                                { $eq: ['$operation', 'ISSUE'] },
                                { $abs: '$quantity' },
                                0
                            ]
                        }
                    },
                    avgStock: { $avg: '$quantity' }
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
                    totalIssued: 1,
                    avgStock: 1,
                    turnoverRatio: {
                        $cond: [
                            { $gt: ['$avgStock', 0] },
                            { $divide: ['$totalIssued', '$avgStock'] },
                            0
                        ]
                    }
                }
            },
            { $sort: { turnoverRatio: -1 } }
        ]);

        return turnoverData;
    }
}

export default PredictionService;
