// Order ID Management System
// This file manages the hierarchical order ID system that connects with warehouse categories

import { WarehouseCategoryUtils } from './warehouseCategories.js';

export class OrderIdManager {

    // Generate main order ID: ORD-YYYY-NNNNNN
    static generateMainOrderId() {
        const year = new Date().getFullYear();
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `ORD-${year}-${timestamp}${random}`;
    }

    // Generate sub order ID: ORD-YYYY-NNNNNN-WH-SEQ
    static generateSubOrderId(mainOrderId, warehouseCode, sequence = 1) {
        const seqNum = sequence.toString().padStart(3, '0');
        return `${mainOrderId}-${warehouseCode}-${seqNum}`;
    }

    // Generate inventory allocation ID: ORD-YYYY-NNNNNN-WH-SEQ-INV-ID
    static generateInventoryAllocationId(subOrderId, categoryId) {
        return `${subOrderId}-${categoryId}`;
    }

    // Parse main order ID to get components
    static parseMainOrderId(orderId) {
        const parts = orderId.split('-');
        if (parts.length >= 3 && parts[0] === 'ORD') {
            return {
                prefix: parts[0],
                year: parts[1],
                number: parts[2],
                isValid: true
            };
        }
        return { isValid: false };
    }

    // Parse sub order ID to get components
    static parseSubOrderId(subOrderId) {
        const parts = subOrderId.split('-');
        if (parts.length >= 5 && parts[0] === 'ORD') {
            return {
                mainOrderId: `${parts[0]}-${parts[1]}-${parts[2]}`,
                warehouseCode: parts[3],
                sequence: parts[4],
                isValid: true
            };
        }
        return { isValid: false };
    }

    // Validate order ID format
    static validateOrderId(orderId) {
        return this.parseMainOrderId(orderId).isValid;
    }

    // Validate sub order ID format
    static validateSubOrderId(subOrderId) {
        return this.parseSubOrderId(subOrderId).isValid;
    }

    // Get warehouse from sub order ID
    static getWarehouseFromSubOrderId(subOrderId) {
        const parsed = this.parseSubOrderId(subOrderId);
        return parsed.isValid ? parsed.warehouseCode : null;
    }

    // Get main order ID from sub order ID
    static getMainOrderIdFromSubOrderId(subOrderId) {
        const parsed = this.parseSubOrderId(subOrderId);
        return parsed.isValid ? parsed.mainOrderId : null;
    }

    // Group items by warehouse for sub order creation
    static groupItemsByWarehouse(orderItems) {
        const warehouseGroups = {};

        for (const item of orderItems) {
            // Determine warehouse based on material category and inventory categoryId
            const warehouseCode = this.determineWarehouseForItem(item);

            if (!warehouseGroups[warehouseCode]) {
                warehouseGroups[warehouseCode] = {
                    warehouseCode,
                    items: [],
                    totalAmount: 0
                };
            }

            warehouseGroups[warehouseCode].items.push(item);
            warehouseGroups[warehouseCode].totalAmount += item.totalPrice || 0;
        }

        return warehouseGroups;
    }

    // Determine warehouse for an item based on its category
    static determineWarehouseForItem(item) {
        // If item has categoryId, extract warehouse from it
        if (item.categoryId) {
            const warehouseCode = item.categoryId.split('-')[0];
            if (['W1', 'W2', 'W3', 'WM'].includes(warehouseCode)) {
                return warehouseCode;
            }
        }

        // Fallback: determine by material category name
        if (item.materialCategory || item.category) {
            const category = item.materialCategory || item.category;
            return this.mapCategoryToWarehouse(category);
        }

        // Default to main warehouse
        return 'WM';
    }

    // Map material category to warehouse code
    static mapCategoryToWarehouse(categoryName) {
        const categoryMappings = {
            // W1 - Sand & Aggregate
            'Fine Sand': 'W1',
            'Medium Sand': 'W1',
            'Coarse Sand': 'W1',
            'River Sand': 'W1',
            'Washed Sand': 'W1',
            'M-Sand (Crushed Rock)': 'W1',
            'Aggregate': 'W1',
            'Gravel': 'W1',
            'Stone Chips': 'W1',
            'Sand & Aggregate': 'W1',
            'Aggregates': 'W1',

            // W2 - Bricks & Masonry
            'Solid Cement Blocks': 'W2',
            'Hollow Cement Blocks': 'W2',
            'Clay Bricks': 'W2',
            '4 Inch Blocks': 'W2',
            '6 Inch Blocks': 'W2',
            '8 Inch Blocks': 'W2',
            'Masonry Blocks': 'W2',
            'Interlocking Pavers': 'W2',
            'Granite Slabs': 'W2',
            'Decorative Stones': 'W2',
            'Bricks & Masonry': 'W2',
            'Bricks & Blocks': 'W2',
            'Bricks': 'W2',

            // W3 - Steel & Metal
            '6mm Steel Rods': 'W3',
            '8mm Steel Rods': 'W3',
            '10mm Steel Rods': 'W3',
            '12mm Steel Rods': 'W3',
            '16mm Steel Rods': 'W3',
            '20mm Steel Rods': 'W3',
            '25mm Steel Rods': 'W3',
            'Steel Wire': 'W3',
            'Steel Mesh': 'W3',
            'Steel Plates': 'W3',
            'Angle Bars': 'W3',
            'Channel Bars': 'W3',
            'Steel & Reinforcement': 'W3',

            // WM - Main Warehouse (everything else)
            'Tools & Equipment': 'WM',
            'Hand Tools': 'WM',
            'Power Tools': 'WM',
            'Power Drills': 'WM',
            'Grinders': 'WM',
            'Saws': 'WM',
            'Welding Equipment': 'WM',
            'Measuring Tools': 'WM',
            'Safety Gear': 'WM',
            'Safety Equipment': 'WM',
            'Cutting Tools': 'WM',
            'Angle Grinders': 'WM',
            'Cement': 'WM',
            'Paint & Chemicals': 'WM',
            'Electrical Items': 'WM',
            'Electrical': 'WM',
            'Plumbing Supplies': 'WM',
            'Plumbing': 'WM',
            'Tiles & Ceramics': 'WM',
            'Roofing Materials': 'WM',
            'Hardware & Fasteners': 'WM',
            'Materials': 'WM',
            'Other': 'WM'
        };

        return categoryMappings[categoryName] || 'WM';
    }

    // Create order tracking info
    static createOrderTrackingInfo(mainOrderId, subOrders = []) {
        return {
            mainOrderId,
            totalSubOrders: subOrders.length,
            warehouseBreakdown: subOrders.reduce((acc, subOrder) => {
                const warehouse = subOrder.warehouseCode;
                if (!acc[warehouse]) {
                    acc[warehouse] = {
                        subOrderId: subOrder.subOrderNumber,
                        itemCount: subOrder.items.length,
                        totalAmount: subOrder.totalAmount || 0
                    };
                }
                return acc;
            }, {}),
            orderHierarchy: {
                main: mainOrderId,
                subs: subOrders.map(sub => ({
                    id: sub.subOrderNumber,
                    warehouse: sub.warehouseCode,
                    status: sub.status
                }))
            }
        };
    }
}

export default OrderIdManager;
