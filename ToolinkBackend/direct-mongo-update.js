import mongoose from 'mongoose';

const directMongoUpdate = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to database');

        const db = mongoose.connection.db;
        const ordersCollection = db.collection('orders');

        // Find orders without subOrderId in items
        const orders = await ordersCollection.find({}).toArray();
        console.log(`📋 Found ${orders.length} orders to check`);

        let updated = 0;

        for (const order of orders) {
            let needsUpdate = false;

            // Check if any items are missing subOrderId
            for (const item of order.items) {
                if (!item.subOrderId) {
                    needsUpdate = true;
                    break;
                }
            }

            if (needsUpdate) {
                console.log(`Updating order: ${order.orderNumber}`);

                // Add subOrderId to items that don't have it
                const updatedItems = order.items.map(item => {
                    if (!item.subOrderId) {
                        const timestamp = Date.now();
                        const random = Math.random().toString(36).substr(2, 6);
                        return {
                            ...item,
                            subOrderId: `SO-${timestamp}-${random}`
                        };
                    }
                    return item;
                });

                // Update the document directly
                const result = await ordersCollection.updateOne(
                    { _id: order._id },
                    { $set: { items: updatedItems } }
                );

                console.log(`  ✅ Updated ${result.modifiedCount} document`);
                updated++;
            }
        }

        // Verification
        const verification = await ordersCollection.find({
            'items.subOrderId': { $exists: true }
        }).toArray();

        console.log('\n📊 FINAL STATUS:');
        console.log(`Orders processed: ${orders.length}`);
        console.log(`Orders updated: ${updated}`);
        console.log(`Orders with subOrderId: ${verification.length}`);

        // Check a sample order
        const sampleOrder = await ordersCollection.findOne();
        if (sampleOrder && sampleOrder.items[0]) {
            console.log('\n🔍 Sample item fields after update:');
            console.log(Object.keys(sampleOrder.items[0]));
            console.log('subOrderId present:', 'subOrderId' in sampleOrder.items[0]);
            if (sampleOrder.items[0].subOrderId) {
                console.log('subOrderId value:', sampleOrder.items[0].subOrderId);
            }
        }

        mongoose.connection.close();
        console.log('🔌 Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error.message);
        mongoose.connection.close();
    }
};

directMongoUpdate();
