import mongoose from 'mongoose';
import Order from './src/models/Order.js';

const finalCheck = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to database');

        // Get one order and show all its item fields
        const order = await Order.findOne().lean();
        if (order && order.items[0]) {
            const item = order.items[0];
            console.log('\n🔍 Complete Item Structure:');
            console.log('Fields:', Object.keys(item));
            console.log('\n📋 All Field Values:');
            Object.keys(item).forEach(key => {
                console.log(`${key}: ${item[key]}`);
            });
        }

        // Count verification with correct query
        const totalOrders = await Order.countDocuments();
        const withWarehouse = await Order.countDocuments({
            'items': { $elemMatch: { 'warehouseCode': { $exists: true } } }
        });
        const withSubOrder = await Order.countDocuments({
            'items': { $elemMatch: { 'subOrderId': { $exists: true } } }
        });
        const withCategory = await Order.countDocuments({
            'items': { $elemMatch: { 'categoryId': { $exists: true } } }
        });

        console.log('\n📊 FINAL MIGRATION STATUS:');
        console.log(`Total orders: ${totalOrders}`);
        console.log(`Orders with warehouseCode: ${withWarehouse}`);
        console.log(`Orders with subOrderId: ${withSubOrder}`);
        console.log(`Orders with categoryId: ${withCategory}`);
        console.log(`Migration complete: ${withWarehouse === totalOrders && withSubOrder === totalOrders ? '✅ YES' : '❌ NO'}`);

        mongoose.connection.close();

    } catch (error) {
        console.error('❌ Error:', error.message);
        mongoose.connection.close();
    }
};

finalCheck();
