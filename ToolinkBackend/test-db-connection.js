import mongoose from 'mongoose';
import Order from './src/models/Order.js';

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB connected successfully');

        // Check existing orders
        const orderCount = await Order.countDocuments();
        console.log(`📊 Total orders in database: ${orderCount}`);

        // Check orders with old structure (missing new fields)
        const oldStructureCount = await Order.countDocuments({
            $or: [
                { 'items.warehouseCode': { $exists: false } },
                { 'items.subOrderId': { $exists: false } }
            ]
        });
        console.log(`🔧 Orders needing migration: ${oldStructureCount}`);

        // Show sample order structure
        const sampleOrder = await Order.findOne().lean();
        if (sampleOrder) {
            console.log('📋 Sample order structure:');
            console.log('- Order ID:', sampleOrder._id);
            console.log('- Order Number:', sampleOrder.orderNumber);
            console.log('- Items count:', sampleOrder.items?.length || 0);
            if (sampleOrder.items && sampleOrder.items[0]) {
                const firstItem = sampleOrder.items[0];
                console.log('- First item fields:', Object.keys(firstItem));
                console.log('- Has warehouseCode:', 'warehouseCode' in firstItem);
                console.log('- Has subOrderId:', 'subOrderId' in firstItem);
                console.log('- Has categoryId:', 'categoryId' in firstItem);
            }
        }

        mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        process.exit(1);
    }
};

connectDB();
