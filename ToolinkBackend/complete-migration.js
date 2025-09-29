import mongoose from 'mongoose';
import Order from './src/models/Order.js';

const addAllMissingFields = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to database');

        // Get all orders
        const orders = await Order.find({});
        console.log(`📋 Processing ${orders.length} orders`);

        let updated = 0;

        for (const order of orders) {
            console.log(`\nProcessing order: ${order.orderNumber}`);

            let hasChanges = false;

            for (let i = 0; i < order.items.length; i++) {
                console.log(`  Item ${i + 1}:`);

                // Add subOrderId if missing
                if (!order.items[i].subOrderId) {
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substr(2, 6);
                    order.items[i].subOrderId = `SO-${timestamp}-${random}`;
                    hasChanges = true;
                    console.log(`    ✅ Added subOrderId: ${order.items[i].subOrderId}`);
                } else {
                    console.log(`    ℹ️  Has subOrderId: ${order.items[i].subOrderId}`);
                }

                // Add status if missing
                if (!order.items[i].status) {
                    order.items[i].status = 'pending';
                    hasChanges = true;
                    console.log(`    ✅ Added status: pending`);
                } else {
                    console.log(`    ℹ️  Has status: ${order.items[i].status}`);
                }

                // Check other fields
                console.log(`    - warehouseCode: ${order.items[i].warehouseCode || 'missing'}`);
                console.log(`    - categoryId: ${order.items[i].categoryId || 'missing'}`);
                console.log(`    - materialName: ${order.items[i].materialName || 'missing'}`);
            }

            if (hasChanges) {
                try {
                    await order.save();
                    console.log(`  ✅ Updated order ${order.orderNumber}`);
                    updated++;
                } catch (saveError) {
                    console.error(`  ❌ Failed to save order ${order.orderNumber}:`, saveError.message);
                }
            } else {
                console.log(`  ℹ️  Order ${order.orderNumber} already complete`);
            }
        }

        // Final verification
        const allOrders = await Order.countDocuments();
        const withSubOrderIds = await Order.countDocuments({
            'items': { $elemMatch: { 'subOrderId': { $exists: true } } }
        });
        const withWarehouseCodes = await Order.countDocuments({
            'items': { $elemMatch: { 'warehouseCode': { $exists: true } } }
        });

        console.log('\n=== MIGRATION SUMMARY ===');
        console.log(`Total orders: ${allOrders}`);
        console.log(`Orders with subOrderId: ${withSubOrderIds}`);
        console.log(`Orders with warehouseCode: ${withWarehouseCodes}`);
        console.log(`Orders updated in this run: ${updated}`);
        console.log('========================');

        mongoose.connection.close();
        console.log('🔌 Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error.message);
        mongoose.connection.close();
    }
};

addAllMissingFields();
