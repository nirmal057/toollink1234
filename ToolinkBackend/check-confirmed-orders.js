import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

// Define order schema
const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

async function checkConfirmedOrders() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://127.0.0.1:27017/toollink');
        console.log('✅ Connected to MongoDB');

        // Get all orders first - let's see all fields
        const allOrders = await Order.find({}).limit(5);
        console.log(`\n📊 Total orders found: ${allOrders.length}`);

        console.log('\n=== ALL ORDERS WITH ALL FIELDS ===');
        allOrders.forEach((order, i) => {
            console.log(`${i + 1}. Order Object:`, JSON.stringify(order, null, 2));
            console.log('---');
        });

        // Filter for confirmed orders
        const confirmedOrders = allOrders.filter(order => {
            if (!order.status) return false;
            const status = order.status.toLowerCase().trim();
            return status === 'confirmed' || status === 'confirm' || status === 'approved';
        });

        console.log(`\n✅ CONFIRMED ORDERS FOUND: ${confirmedOrders.length}`);
        if (confirmedOrders.length > 0) {
            confirmedOrders.forEach((order, i) => {
                console.log(`${i + 1}. ✅ ${order.orderId} - ${order.customerName} - Status: "${order.status}" - Rs.${order.total}`);
            });
        } else {
            console.log('❌ No confirmed orders found');
            console.log('\n🔍 Available statuses in database:');
            const uniqueStatuses = [...new Set(allOrders.map(o => o.status))];
            uniqueStatuses.forEach(status => {
                console.log(`   - "${status}"`);
            });
        }

        // Close connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkConfirmedOrders();
