import mongoose from 'mongoose';
import Order from './src/models/Order.js';
import SubOrder from './src/models/SubOrder.js';

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ MongoDB connected for linking SubOrders');
        return true;
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        return false;
    }
};

const linkSubOrdersWithOrderItems = async () => {
    console.log('🔗 Starting to link SubOrders with Order items using subOrderId...');

    if (!await connectDB()) {
        return;
    }

    try {
        // Get all orders with subOrderId in items
        const orders = await Order.find({
            'items.subOrderId': { $exists: true }
        });

        console.log(`📋 Found ${orders.length} orders with subOrderId`);

        // Get all subOrders
        const subOrders = await SubOrder.find({});
        console.log(`📦 Found ${subOrders.length} subOrders to link`);

        let linkedCount = 0;
        let errors = 0;

        for (const order of orders) {
            console.log(`\n🔄 Processing order: ${order.orderNumber}`);

            for (let i = 0; i < order.items.length; i++) {
                const item = order.items[i];

                if (!item.subOrderId || !item.warehouseCode) {
                    console.log(`  ⚠️  Item ${i + 1}: missing subOrderId or warehouseCode`);
                    continue;
                }

                console.log(`  🔍 Looking for SubOrder for item with:`);
                console.log(`    - subOrderId: ${item.subOrderId}`);
                console.log(`    - warehouseCode: ${item.warehouseCode}`);
                console.log(`    - materialName: ${item.materialName}`);

                // Find the corresponding SubOrder
                // We need to match by main order and warehouse code
                const convertedOrderNumber = convertOrderNumberFormat(order.orderNumber);

                const matchingSubOrders = await SubOrder.find({
                    mainOrderNumber: convertedOrderNumber,
                    warehouseCode: item.warehouseCode
                });

                console.log(`    Found ${matchingSubOrders.length} matching SubOrders`);

                if (matchingSubOrders.length > 0) {
                    const subOrder = matchingSubOrders[0]; // Take the first matching one

                    // Check if this item's material matches any in the subOrder
                    const matchingSubOrderItem = subOrder.items.find(subItem =>
                        subItem.materialName === item.materialName ||
                        subItem.inventoryItemId?.toString() === item.inventory?.toString()
                    );

                    if (matchingSubOrderItem) {
                        console.log(`    ✅ Found matching SubOrder: ${subOrder.subOrderNumber}`);
                        console.log(`    📝 Linking item subOrderId ${item.subOrderId} with SubOrder ${subOrder._id}`);

                        // We can store the relationship in different ways:
                        // Option 1: Add subOrderId to the SubOrder items
                        // Option 2: Add subOrderReference to Order items
                        // Option 3: Create a mapping collection

                        // Let's go with Option 1: Add the original subOrderId to SubOrder items
                        try {
                            await SubOrder.updateOne(
                                {
                                    _id: subOrder._id,
                                    'items.materialName': matchingSubOrderItem.materialName
                                },
                                {
                                    $set: {
                                        'items.$.originalSubOrderId': item.subOrderId,
                                        'items.$.orderItemId': item._id
                                    }
                                }
                            );

                            console.log(`    🔗 Linked successfully`);
                            linkedCount++;

                        } catch (linkError) {
                            console.error(`    ❌ Failed to link: ${linkError.message}`);
                            errors++;
                        }
                    } else {
                        console.log(`    ⚠️  No matching item found in SubOrder`);
                    }
                } else {
                    console.log(`    ❌ No matching SubOrder found`);
                    errors++;
                }
            }
        }

        // Verification
        const subOrdersWithLinks = await SubOrder.find({
            'items.originalSubOrderId': { $exists: true }
        });

        console.log('\n=== LINKING SUMMARY ===');
        console.log(`Orders processed: ${orders.length}`);
        console.log(`Items linked: ${linkedCount}`);
        console.log(`Errors: ${errors}`);
        console.log(`SubOrders with links: ${subOrdersWithLinks.length}`);

        // Show sample linked data
        if (subOrdersWithLinks.length > 0) {
            console.log('\n📋 Sample linked SubOrders:');
            for (const subOrder of subOrdersWithLinks.slice(0, 3)) {
                console.log(`\nSubOrder: ${subOrder.subOrderNumber} (${subOrder.warehouseCode})`);
                subOrder.items.forEach((item, idx) => {
                    if (item.originalSubOrderId) {
                        console.log(`  Item ${idx + 1}: ${item.materialName}`);
                        console.log(`    Original SubOrderId: ${item.originalSubOrderId}`);
                        console.log(`    OrderItemId: ${item.orderItemId}`);
                    }
                });
            }
        }
        console.log('========================');

    } catch (error) {
        console.error('❌ Linking failed:', error.message);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Helper function to convert order number format
const convertOrderNumberFormat = (orderNumber) => {
    // Convert ORD-20250929-0004 to ORD-2025-000000004 format
    const parts = orderNumber.split('-');
    if (parts.length !== 3) return orderNumber;

    const year = parts[1].substring(0, 4); // 2025
    const number = parts[2].padStart(9, '0'); // 000000004

    return `ORD-${year}-${number}`;
};

// Run the linking
linkSubOrdersWithOrderItems().then(() => {
    console.log('🎉 SubOrder linking completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 SubOrder linking failed:', error);
    process.exit(1);
});
