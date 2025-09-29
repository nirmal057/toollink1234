import mongoose from 'mongoose';
import Order from './src/models/Order.js';

const connectAndCheck = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to database');

        // Get a sample order to see its structure
        const order = await Order.findOne().lean();
        console.log('\n📋 Sample Order Structure:');
        console.log(JSON.stringify(order, null, 2));

        mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

connectAndCheck();
