import mongoose from 'mongoose';
import Order from './src/models/Order.js';
import SubOrder from './src/models/SubOrder.js';
import Warehouse from './src/models/Warehouse.js';
import Inventory from './src/models/Inventory.js';

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ MongoDB connected for SubOrder population');
        return true;
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        return false;
    }
};

// Helper function to get warehouse by name mapping
const getWarehouseByCode = async (warehouseCode) => {
    const nameMapping = {
        'W1': 'Sand & Aggregate',
        'W2': 'Bricks & Masonry',
        'W3': 'Steel & Metal',
        'WM': 'Main Warehouse'
    };

    const warehouseName = nameMapping[warehouseCode];
    if (!warehouseName) return null;

    return await Warehouse.findOne({ name: warehouseName });
};

// Helper function to map warehouse code to category
const getWarehouseCategoryFromCode = (warehouseCode) => {
    const categoryMapping = {
        'W1': 'Aggregates',
        'W2': 'Bricks & Blocks',
        'W3': 'Steel & Reinforcement',
        'WM': 'Other'
    };
    return categoryMapping[warehouseCode] || 'Other';
};

// Helper function to generate sub-order number
const generateSubOrderNumber = (mainOrderNumber, warehouseCode, sequence) => {
    // Format: ORD-YYYY-NNNNNNNNN-WH-SSS
    const sequenceStr = sequence.toString().padStart(3, '0');
    return `${mainOrderNumber}-${warehouseCode}-${sequenceStr}`;
};

const populateSubOrdersV2 = async () => {
    console.log('🚀 Starting SubOrders population from main Orders (v2)...');

    if (!await connectDB()) {
        return;
    }

    try {
        // Clear existing sub-orders to avoid duplicates
        console.log('🗑️  Clearing existing SubOrders...');
        await SubOrder.deleteMany({});
        console.log('✅ Existing SubOrders cleared');

        // Get all warehouses
        const warehouses = await Warehouse.find({});
        console.log(`📍 Found ${warehouses.length} warehouses:`);
        warehouses.forEach(wh => {
            console.log(`  - ${wh.name} (ID: ${wh._id})`);
        });

        // Get all orders with items that have subOrderId
        const orders = await Order.find({
            'items.subOrderId': { $exists: true }
        }).populate('items.inventory');

        console.log(`📋 Found ${orders.length} orders to process`);

        let createdSubOrders = 0;
        let errors = 0;

        for (const order of orders) {
            try {
                console.log(`\n🔄 Processing order: ${order.orderNumber}`);

                // Group items by warehouse code
                const warehouseGroups = {};

                for (let i = 0; i < order.items.length; i++) {
                    const item = order.items[i];

                    if (!item.warehouseCode || !item.subOrderId) {
                        console.log(`  ⚠️  Skipping item ${i + 1}: missing warehouseCode or subOrderId`);
                        continue;
                    }

                    if (!warehouseGroups[item.warehouseCode]) {
                        warehouseGroups[item.warehouseCode] = [];
                    }

                    warehouseGroups[item.warehouseCode].push({
                        ...item.toObject(),
                        orderItemIndex: i
                    });
                }

                // Create sub-orders for each warehouse group
                let warehouseSequence = 1;

                for (const [warehouseCode, warehouseItems] of Object.entries(warehouseGroups)) {
                    console.log(`  📦 Creating sub-order for warehouse ${warehouseCode} with ${warehouseItems.length} items`);

                    // Get warehouse by code mapping
                    const warehouse = await getWarehouseByCode(warehouseCode);
                    if (!warehouse) {
                        console.log(`  ❌ Could not find warehouse for code ${warehouseCode}`);
                        errors++;
                        continue;
                    }

                    const subOrderNumber = generateSubOrderNumber(order.orderNumber, warehouseCode, warehouseSequence);

                    // Prepare items for sub-order
                    const subOrderItems = [];

                    for (const item of warehouseItems) {
                        let materialId = null;
                        let materialName = item.materialName || 'Unknown Material';

                        // Try to get material info from inventory
                        if (item.inventory) {
                            if (typeof item.inventory === 'object' && item.inventory._id) {
                                materialId = item.inventory._id;
                                materialName = item.inventory.name || materialName;
                            } else {
                                materialId = item.inventory;
                                // Try to populate material name
                                try {
                                    const inventory = await Inventory.findById(item.inventory);
                                    if (inventory) {
                                        materialName = inventory.name || materialName;
                                    }
                                } catch (err) {
                                    console.log(`    ⚠️  Could not find inventory ${item.inventory}`);
                                }
                            }
                        }

                        subOrderItems.push({
                            materialId: materialId || item.inventory,
                            materialName: materialName,
                            categoryId: item.categoryId,
                            inventoryItemId: item.inventory,
                            qty: item.quantity
                        });
                    }

                    // Create the sub-order
                    const subOrder = new SubOrder({
                        subOrderNumber: subOrderNumber,
                        mainOrderNumber: order.orderNumber,
                        mainOrderId: order._id,
                        warehouseId: warehouse._id,
                        warehouseCode: warehouseCode,
                        materialCategory: getWarehouseCategoryFromCode(warehouseCode),
                        items: subOrderItems,
                        scheduledAt: order.delivery?.estimatedDate || new Date(),
                        scheduledTime: '09:00', // Default time
                        status: 'created',
                        history: [{
                            action: 'SubOrder created from main order',
                            byUserId: order.createdBy,
                            note: `Auto-generated from order ${order.orderNumber}`
                        }]
                    });

                    try {
                        await subOrder.save();
                        console.log(`    ✅ Created sub-order: ${subOrderNumber} (Warehouse: ${warehouse.name})`);
                        createdSubOrders++;
                    } catch (saveError) {
                        console.error(`    ❌ Failed to save sub-order ${subOrderNumber}:`, saveError.message);
                        errors++;
                    }

                    warehouseSequence++;
                }

            } catch (orderError) {
                console.error(`❌ Error processing order ${order.orderNumber}:`, orderError.message);
                errors++;
            }
        }

        // Final verification
        const totalSubOrders = await SubOrder.countDocuments();
        const subOrdersByWarehouse = await SubOrder.aggregate([
            { $group: { _id: '$warehouseCode', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Show some sample sub-orders
        const sampleSubOrders = await SubOrder.find({}).limit(3).populate('warehouseId');

        console.log('\n=== SUBORDERS POPULATION SUMMARY ===');
        console.log(`Orders processed: ${orders.length}`);
        console.log(`SubOrders created: ${createdSubOrders}`);
        console.log(`Errors: ${errors}`);
        console.log(`Total SubOrders in DB: ${totalSubOrders}`);
        console.log('\nSubOrders by warehouse:');
        subOrdersByWarehouse.forEach(wh => {
            console.log(`  ${wh._id}: ${wh.count} sub-orders`);
        });

        if (sampleSubOrders.length > 0) {
            console.log('\nSample SubOrders created:');
            sampleSubOrders.forEach(so => {
                console.log(`  - ${so.subOrderNumber} (${so.warehouseCode}) - ${so.items.length} items`);
            });
        }
        console.log('====================================');

    } catch (error) {
        console.error('❌ Population failed:', error.message);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Run the population
populateSubOrdersV2().then(() => {
    console.log('🎉 SubOrders population completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 SubOrders population failed:', error);
    process.exit(1);
});
