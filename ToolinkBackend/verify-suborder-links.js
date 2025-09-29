import mongoose from 'mongoose';
import Order from './src/models/Order.js';
import SubOrder from './src/models/SubOrder.js';
import Warehouse from './src/models/Warehouse.js';

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ MongoDB connected for verification');
        return true;
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        return false;
    }
};

const verifySubOrderLinks = async () => {
    console.log('🔍 Verifying SubOrder links with Order items...');

    if (!await connectDB()) {
        return;
    }

    try {
        // Get all SubOrders to check their structure
        const allSubOrders = await SubOrder.find({}).populate('warehouseId');
        console.log(`📦 Found ${allSubOrders.length} SubOrders total`);

        // Check for linked items
        let linkedItemsCount = 0;
        let subOrdersWithLinks = 0;

        console.log('\n📋 SubOrder Details:');

        for (const subOrder of allSubOrders) {
            let hasLinkedItems = false;

            console.log(`\n📦 SubOrder: ${subOrder.subOrderNumber}`);
            console.log(`   Warehouse: ${subOrder.warehouseId?.name} (${subOrder.warehouseCode})`);
            console.log(`   Main Order: ${subOrder.mainOrderNumber}`);
            console.log(`   Items: ${subOrder.items.length}`);

            for (let i = 0; i < subOrder.items.length; i++) {
                const item = subOrder.items[i];
                console.log(`     Item ${i + 1}: ${item.materialName}`);
                console.log(`       Qty: ${item.qty}`);
                console.log(`       CategoryId: ${item.categoryId}`);

                if (item.originalSubOrderId) {
                    console.log(`       🔗 Original SubOrderId: ${item.originalSubOrderId}`);
                    console.log(`       🔗 OrderItemId: ${item.orderItemId}`);
                    hasLinkedItems = true;
                    linkedItemsCount++;
                } else {
                    console.log(`       ❌ No link found`);
                }
            }

            if (hasLinkedItems) {
                subOrdersWithLinks++;
            }
        }

        // Get Orders and show their subOrderIds
        const orders = await Order.find({ 'items.subOrderId': { $exists: true } });

        console.log(`\n📋 Order Items with SubOrderIds:`);
        for (const order of orders.slice(0, 3)) { // Show first 3 for brevity
            console.log(`\n📄 Order: ${order.orderNumber}`);

            for (let i = 0; i < order.items.length; i++) {
                const item = order.items[i];
                if (item.subOrderId) {
                    console.log(`   Item ${i + 1}: ${item.materialName}`);
                    console.log(`     SubOrderId: ${item.subOrderId}`);
                    console.log(`     WarehouseCode: ${item.warehouseCode}`);
                    console.log(`     CategoryId: ${item.categoryId}`);
                }
            }
        }

        // Summary statistics
        console.log('\n=== VERIFICATION SUMMARY ===');
        console.log(`Total SubOrders: ${allSubOrders.length}`);
        console.log(`SubOrders with links: ${subOrdersWithLinks}`);
        console.log(`Total linked items: ${linkedItemsCount}`);
        console.log(`Orders with subOrderIds: ${orders.length}`);

        // Count total order items with subOrderId
        let totalOrderItems = 0;
        orders.forEach(order => {
            order.items.forEach(item => {
                if (item.subOrderId) totalOrderItems++;
            });
        });
        console.log(`Order items with subOrderId: ${totalOrderItems}`);
        console.log(`Link success rate: ${linkedItemsCount}/${totalOrderItems} = ${((linkedItemsCount / totalOrderItems) * 100).toFixed(1)}%`);
        console.log('============================');

        // Test a specific lookup
        if (orders.length > 0 && orders[0].items.length > 0) {
            const testItem = orders[0].items[0];
            console.log(`\n🧪 Test Lookup:`);
            console.log(`Looking for SubOrder item with originalSubOrderId: ${testItem.subOrderId}`);

            const foundSubOrder = await SubOrder.findOne({
                'items.originalSubOrderId': testItem.subOrderId
            });

            if (foundSubOrder) {
                console.log(`✅ Found linked SubOrder: ${foundSubOrder.subOrderNumber}`);
            } else {
                console.log(`❌ Could not find linked SubOrder`);
            }
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Run the verification
verifySubOrderLinks().then(() => {
    console.log('🎉 Verification completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Verification failed:', error);
    process.exit(1);
});
