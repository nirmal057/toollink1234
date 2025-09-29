import mongoose from 'mongoose';
import Order from './src/models/Order.js';
import Inventory from './src/models/Inventory.js';

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ MongoDB connected for migration');
        return true;
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        return false;
    }
};

// Helper function to determine warehouse code from material category
const getWarehouseCodeFromCategory = (category) => {
    if (!category) return 'WM';

    const categoryLower = category.toLowerCase();

    // W1 - Sand & Aggregates
    if (categoryLower.includes('sand') || categoryLower.includes('aggregate') ||
        categoryLower.includes('gravel') || categoryLower.includes('stone')) {
        return 'W1';
    }

    // W2 - Bricks & Masonry
    if (categoryLower.includes('brick') || categoryLower.includes('block') ||
        categoryLower.includes('masonry') || categoryLower.includes('paver')) {
        return 'W2';
    }

    // W3 - Steel & Metal
    if (categoryLower.includes('steel') || categoryLower.includes('metal') ||
        categoryLower.includes('rod') || categoryLower.includes('wire') ||
        categoryLower.includes('mesh') || categoryLower.includes('reinforcement')) {
        return 'W3';
    }

    // WM - Tools & Equipment (and everything else)
    return 'WM';
};

// Helper function to get category ID
const getCategoryId = (materialName, warehouseCode) => {
    if (!materialName) return `${warehouseCode}-001`;

    const name = materialName.toLowerCase();

    switch (warehouseCode) {
        case 'W1':
            if (name.includes('fine')) return 'W1-002';
            if (name.includes('river')) return 'W1-005';
            if (name.includes('aggregate')) return 'W1-008';
            if (name.includes('stone')) return 'W1-010';
            return 'W1-001';

        case 'W2':
            if (name.includes('clay')) return 'W2-004';
            if (name.includes('solid')) return 'W2-002';
            if (name.includes('masonry')) return 'W2-008';
            return 'W2-001';

        case 'W3':
            if (name.includes('6mm')) return 'W3-002';
            if (name.includes('12mm')) return 'W3-005';
            if (name.includes('mesh')) return 'W3-010';
            return 'W3-001';

        case 'WM':
            if (name.includes('drill')) return 'WM-004';
            if (name.includes('grinder')) return 'WM-011';
            if (name.includes('cement')) return 'WM-012';
            if (name.includes('hardware')) return 'WM-018';
            return 'WM-001';

        default:
            return 'WM-001';
    }
};

// Main migration function
const migrateOrders = async () => {
    console.log('🚀 Starting Order Migration...');

    if (!await connectDB()) {
        return;
    }

    try {
        // Find orders that need updating
        const orders = await Order.find({
            $or: [
                { 'items.warehouseCode': { $exists: false } },
                { 'items.subOrderId': { $exists: false } }
            ]
        });

        console.log(`📋 Found ${orders.length} orders to migrate`);

        let updated = 0;
        let errors = 0;

        for (const order of orders) {
            try {
                console.log(`Processing order: ${order.orderNumber}`);

                let hasChanges = false;

                for (let i = 0; i < order.items.length; i++) {
                    const item = order.items[i];

                    // Get inventory info
                    let inventory = null;
                    if (item.inventory) {
                        try {
                            inventory = await Inventory.findById(item.inventory);
                        } catch (err) {
                            console.log(`  - Could not find inventory for item ${i}`);
                        }
                    }

                    // Add materialName
                    if (!item.materialName && inventory?.name) {
                        order.items[i].materialName = inventory.name;
                        hasChanges = true;
                        console.log(`  - Added materialName: ${inventory.name}`);
                    }

                    // Add warehouseCode
                    if (!item.warehouseCode) {
                        const warehouseCode = inventory?.category ?
                            getWarehouseCodeFromCategory(inventory.category) : 'WM';
                        order.items[i].warehouseCode = warehouseCode;
                        hasChanges = true;
                        console.log(`  - Added warehouseCode: ${warehouseCode}`);
                    }

                    // Add subOrderId
                    if (!item.subOrderId) {
                        const timestamp = Date.now();
                        const random = Math.random().toString(36).substr(2, 6);
                        order.items[i].subOrderId = `SO-${timestamp}-${random}`;
                        hasChanges = true;
                        console.log(`  - Added subOrderId: ${order.items[i].subOrderId}`);
                    }

                    // Add categoryId
                    if (!item.categoryId && order.items[i].warehouseCode) {
                        const materialName = order.items[i].materialName || inventory?.name || 'Unknown';
                        order.items[i].categoryId = getCategoryId(materialName, order.items[i].warehouseCode);
                        hasChanges = true;
                        console.log(`  - Added categoryId: ${order.items[i].categoryId}`);
                    }

                    // Add default status
                    if (!item.status) {
                        order.items[i].status = 'pending';
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    await order.save();
                    console.log(`✅ Updated order ${order.orderNumber}`);
                    updated++;
                } else {
                    console.log(`ℹ️  Order ${order.orderNumber} already up to date`);
                }

            } catch (error) {
                console.error(`❌ Error updating order ${order.orderNumber}:`, error.message);
                errors++;
            }
        }

        // Verification
        const migratedCount = await Order.countDocuments({
            'items.warehouseCode': { $exists: true },
            'items.subOrderId': { $exists: true }
        });

        console.log('\n=== MIGRATION COMPLETE ===');
        console.log(`Orders processed: ${orders.length}`);
        console.log(`Orders updated: ${updated}`);
        console.log(`Errors: ${errors}`);
        console.log(`Orders with new fields: ${migratedCount}`);
        console.log('==========================');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Run migration
migrateOrders().then(() => {
    console.log('🎉 Migration process completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
});
