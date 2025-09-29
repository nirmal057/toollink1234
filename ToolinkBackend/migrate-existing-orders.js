import mongoose from 'mongoose';
import Order from './src/models/Order.js';
import Inventory from './src/models/Inventory.js';

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected for migration');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

// Helper function to determine warehouse code from material category
const getWarehouseCodeFromCategory = (category) => {
    const categoryMapping = {
        // W1 - Sand & Aggregates
        'Sand & Aggregate': 'W1',
        'Fine Sand': 'W1',
        'Medium Sand': 'W1',
        'Coarse Sand': 'W1',
        'River Sand': 'W1',
        'Washed Sand': 'W1',
        'M-Sand (Crushed Rock)': 'W1',
        'Aggregate': 'W1',
        'Gravel': 'W1',
        'Stone Chips': 'W1',
        'Aggregates': 'W1',

        // W2 - Bricks & Masonry
        'Bricks & Masonry': 'W2',
        'Solid Cement Blocks': 'W2',
        'Hollow Cement Blocks': 'W2',
        'Clay Bricks': 'W2',
        '4 Inch Blocks': 'W2',
        '6 Inch Blocks': 'W2',
        '8 Inch Blocks': 'W2',
        'Interlocking Pavers': 'W2',
        'Granite Slabs': 'W2',
        'Decorative Stones': 'W2',
        'Masonry Blocks': 'W2',
        'Bricks': 'W2',
        'Bricks & Blocks': 'W2',

        // W3 - Steel & Metal
        'Steel & Reinforcement': 'W3',
        '6mm Steel Rods': 'W3',
        '8mm Steel Rods': 'W3',
        '10mm Steel Rods': 'W3',
        '12mm Steel Rods': 'W3',
        '16mm Steel Rods': 'W3',
        '20mm Steel Rods': 'W3',
        'Steel Wire': 'W3',
        'Wire Mesh': 'W3',
        'Steel Mesh': 'W3',
        'Angle Iron': 'W3',
        'Steel Plates': 'W3',

        // WM - Tools & Equipment (and others)
        'Tools & Equipment': 'WM',
        'Power Drills': 'WM',
        'Angle Grinders': 'WM',
        'Rotary Hammers': 'WM',
        'Hand Tools': 'WM',
        'Measuring Tools': 'WM',
        'Safety Equipment': 'WM',
        'Safety Gear': 'WM',
        'Hardware': 'WM',
        'Electrical Tools': 'WM',
        'Cutting Tools': 'WM',
        'Cement': 'WM',
        'Paint & Chemicals': 'WM',
        'Electrical Items': 'WM',
        'Plumbing Supplies': 'WM',
        'Tiles & Ceramics': 'WM',
        'Roofing Materials': 'WM',
        'Hardware & Fasteners': 'WM',
        'Materials': 'WM',
        'Other': 'WM'
    };

    return categoryMapping[category] || 'WM'; // Default to WM if not found
};

// Helper function to get category ID from material name and warehouse
const getCategoryId = (materialName, warehouseCode) => {
    const name = materialName.toLowerCase();

    switch (warehouseCode) {
        case 'W1':
            if (name.includes('fine') || name.includes('fine sand')) return 'W1-002';
            if (name.includes('river') || name.includes('river sand')) return 'W1-005';
            if (name.includes('aggregate')) return 'W1-008';
            if (name.includes('stone') || name.includes('chip')) return 'W1-010';
            return 'W1-001'; // Default

        case 'W2':
            if (name.includes('clay') || name.includes('brick')) return 'W2-004';
            if (name.includes('solid') || name.includes('cement block')) return 'W2-002';
            if (name.includes('masonry') || name.includes('masonry block')) return 'W2-008';
            return 'W2-001'; // Default

        case 'W3':
            if (name.includes('6mm') || name.includes('6 mm')) return 'W3-002';
            if (name.includes('12mm') || name.includes('12 mm')) return 'W3-005';
            if (name.includes('mesh') || name.includes('steel mesh')) return 'W3-010';
            return 'W3-001'; // Default

        case 'WM':
            if (name.includes('drill') || name.includes('power drill')) return 'WM-004';
            if (name.includes('grinder') || name.includes('angle grinder')) return 'WM-011';
            if (name.includes('cement') || name.includes('concrete')) return 'WM-012';
            if (name.includes('hardware') || name.includes('fastener')) return 'WM-018';
            return 'WM-001'; // Default

        default:
            return 'WM-001';
    }
};

// Migration function to update existing orders
const migrateExistingOrders = async () => {
    try {
        console.log('Starting migration of existing orders...');

        // Get all orders that need updating (missing warehouse info in items)
        const ordersToUpdate = await Order.find({
            $or: [
                { 'items.warehouseCode': { $exists: false } },
                { 'items.subOrderId': { $exists: false } },
                { 'items.categoryId': { $exists: false } },
                { 'items.materialName': { $exists: false } }
            ]
        }).populate('items.inventory');

        console.log(`Found ${ordersToUpdate.length} orders that need updating`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const order of ordersToUpdate) {
            try {
                console.log(`Processing order ${order.orderNumber}...`);

                // Update each item in the order
                for (let i = 0; i < order.items.length; i++) {
                    const item = order.items[i];

                    // Get inventory details if populated
                    let materialName = item.materialName;
                    let inventoryCategory = null;

                    if (item.inventory) {
                        if (typeof item.inventory === 'object' && item.inventory.name) {
                            // Already populated
                            materialName = materialName || item.inventory.name;
                            inventoryCategory = item.inventory.category;
                        } else {
                            // Need to populate manually
                            const inventory = await Inventory.findById(item.inventory);
                            if (inventory) {
                                materialName = materialName || inventory.name;
                                inventoryCategory = inventory.category;
                            }
                        }
                    }

                    // Set material name if missing
                    if (!item.materialName && materialName) {
                        order.items[i].materialName = materialName;
                    }

                    // Determine warehouse code from inventory category
                    if (!item.warehouseCode && inventoryCategory) {
                        const warehouseCode = getWarehouseCodeFromCategory(inventoryCategory);
                        order.items[i].warehouseCode = warehouseCode;
                    }

                    // Generate sub-order ID if missing
                    if (!item.subOrderId) {
                        const timestamp = Date.now();
                        const random = Math.random().toString(36).substr(2, 9);
                        order.items[i].subOrderId = `SO-${timestamp}-${random}`;
                    }

                    // Generate category ID if missing
                    if (!item.categoryId && item.warehouseCode && materialName) {
                        const categoryId = getCategoryId(materialName, item.warehouseCode);
                        order.items[i].categoryId = categoryId;
                    }

                    // Set default status if missing
                    if (!item.status) {
                        order.items[i].status = 'pending';
                    }
                }

                // Save the updated order
                await order.save();
                updatedCount++;
                console.log(`✅ Updated order ${order.orderNumber} - ${order.items.length} items processed`);

            } catch (error) {
                console.error(`❌ Error updating order ${order.orderNumber}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n=== MIGRATION SUMMARY ===');
        console.log(`Total orders processed: ${ordersToUpdate.length}`);
        console.log(`Successfully updated: ${updatedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('=========================\n');

        // Verify the migration
        const verificationOrders = await Order.find({
            'items.warehouseCode': { $exists: true },
            'items.subOrderId': { $exists: true }
        });

        console.log(`✅ Verification: ${verificationOrders.length} orders now have warehouse and sub-order IDs`);

        return {
            processed: ordersToUpdate.length,
            updated: updatedCount,
            errors: errorCount,
            verified: verificationOrders.length
        };

    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    }
};

// Main execution
const runMigration = async () => {
    try {
        await connectDB();

        console.log('🚀 Starting Order Migration Script');
        console.log('Adding warehouse IDs, sub-order IDs, and category IDs to existing orders...\n');

        const results = await migrateExistingOrders();

        console.log('🎉 Migration completed successfully!');
        console.log('Results:', results);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration();
}

export default migrateExistingOrders;
