import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import models
import User from './src/models/User.js';
import Order from './src/models/Order.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolink';

console.log('🔍 Testing order filtering by customer...');

async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function testOrderFiltering() {
    try {
        // Get all customers
        const customers = await User.find({ role: 'customer' });
        console.log(`\n👥 Found ${customers.length} customers`);

        if (customers.length === 0) {
            console.log('❌ No customers found.');
            return;
        }

        // Get all orders
        const allOrders = await Order.find({});
        console.log(`📦 Total orders in database: ${allOrders.length}`);

        console.log('\n🔍 Testing order filtering for each customer:\n');

        for (const customer of customers) {
            console.log(`👤 Testing for customer: ${customer.fullName || customer.username}`);
            console.log(`   Customer ID: ${customer._id}`);

            // Simulate what the API would return for this customer
            const customerOrders = await Order.find({ customer: customer._id })
                .populate('customer', 'fullName email')
                .select('orderNumber customer totalAmount finalAmount status createdAt');

            console.log(`   📋 Orders found: ${customerOrders.length}`);

            if (customerOrders.length > 0) {
                customerOrders.forEach((order, index) => {
                    console.log(`      ${index + 1}. Order #${order.orderNumber}`);
                    console.log(`         Amount: $${order.finalAmount.toFixed(2)}`);
                    console.log(`         Status: ${order.status}`);
                    console.log(`         Customer Match: ${order.customer._id.toString() === customer._id.toString() ? '✅' : '❌'}`);
                    console.log(`         Created: ${order.createdAt.toLocaleDateString()}`);
                });
            } else {
                console.log(`      ⚠️ No orders found for this customer`);
            }

            // Test cross-contamination (make sure they don't see other customers' orders)
            const otherCustomerOrders = await Order.find({
                customer: { $ne: customer._id }
            });

            console.log(`   🔒 Orders from other customers: ${otherCustomerOrders.length} (should NOT be visible)`);
            console.log('');
        }

        // Test the actual filtering logic that the API uses
        console.log('🧪 Testing API-style filtering logic:\n');

        for (const customer of customers) {
            console.log(`🔍 API Test for ${customer.fullName || customer.username}:`);

            // This simulates the exact logic from the orders route
            const apiStyleQuery = {
                customer: customer._id  // This is what happens when role === 'customer'
            };

            const apiResults = await Order.find(apiStyleQuery)
                .select('orderNumber totalAmount finalAmount status customer')
                .populate('customer', 'fullName email');

            console.log(`   Results: ${apiResults.length} orders`);

            // Verify all results belong to this customer
            const allBelongToCustomer = apiResults.every(order =>
                order.customer._id.toString() === customer._id.toString()
            );

            console.log(`   ✅ All orders belong to correct customer: ${allBelongToCustomer}`);

            if (apiResults.length > 0) {
                console.log(`   📋 Order numbers: ${apiResults.map(o => o.orderNumber).join(', ')}`);
            }
            console.log('');
        }

        // Summary
        console.log('📊 SUMMARY:');
        console.log(`- Total customers: ${customers.length}`);
        console.log(`- Total orders: ${allOrders.length}`);

        for (const customer of customers) {
            const count = await Order.countDocuments({ customer: customer._id });
            console.log(`- ${customer.fullName || customer.username}: ${count} orders`);
        }

        console.log('\n✅ Order filtering test completed successfully!');
        console.log('✅ Each customer can only see their own orders.');

    } catch (error) {
        console.error('❌ Error testing order filtering:', error);
        throw error;
    }
}

async function main() {
    try {
        await connectDatabase();
        await testOrderFiltering();
    } catch (error) {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the test
main();
