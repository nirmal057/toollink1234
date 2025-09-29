import mongoose from 'mongoose';
import Order from './src/models/Order.js';

const addMissingSubOrderIds = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to database');

        // Find orders missing subOrderId
        const orders = await Order.find({
            'items.subOrderId': { $exists: false }
        });

        console.log(`📋 Found ${orders.length} orders missing subOrderId`);

        let updated = 0;

        for (const order of orders) {
            console.log(`Processing order: ${order.orderNumber}`);

            let hasChanges = false;

            for (let i = 0; i < order.items.length; i++) {
                if (!order.items[i].subOrderId) {
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substr(2, 6);
                    order.items[i].subOrderId = `SO-${timestamp}-${random}`;
                    hasChanges = true;
                    console.log(`  - Added subOrderId: ${order.items[i].subOrderId}`);
                }
            }

            if (hasChanges) {
                await order.save();
                console.log(`✅ Updated order ${order.orderNumber}`);
                updated++;
            }
        }

        // Final verification
        const allOrders = await Order.countDocuments();
        const withSubOrderIds = await Order.countDocuments({
            'items.subOrderId': { $exists: true }
        });

        console.log('\n=== FINAL STATUS ===');
        console.log(`Total orders: ${allOrders}`);
        console.log(`Orders with subOrderId: ${withSubOrderIds}`);
        console.log(`Orders updated: ${updated}`);
        console.log('===================');

        mongoose.connection.close();
        console.log('🔌 Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error.message);
        mongoose.connection.close();
    }
};

addMissingSubOrderIds();
