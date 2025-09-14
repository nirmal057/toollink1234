import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import models
import User from './src/models/User.js';
import Order from './src/models/Order.js';
import MainOrder from './src/models/MainOrder.js';
import SubOrder from './src/models/SubOrder.js';
import Delivery from './src/models/Delivery.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolink';

console.log('🚀 Starting database cleanup...');
console.log('Database URI:', MONGODB_URI);

async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function cleanupDatabase() {
    try {
        console.log('\n📊 Checking current database state...');

        // Get current counts
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const nonAdminUsers = await User.countDocuments({ role: { $ne: 'admin' } });
        const totalOrders = await Order.countDocuments();
        const totalMainOrders = await MainOrder.countDocuments();
        const totalSubOrders = await SubOrder.countDocuments();
        const totalDeliveries = await Delivery.countDocuments();

        console.log(`Current state:`);
        console.log(`- Total users: ${totalUsers}`);
        console.log(`- Admin users: ${adminUsers}`);
        console.log(`- Non-admin users: ${nonAdminUsers}`);
        console.log(`- Orders: ${totalOrders}`);
        console.log(`- Main Orders: ${totalMainOrders}`);
        console.log(`- Sub Orders: ${totalSubOrders}`);
        console.log(`- Deliveries: ${totalDeliveries}`);

        if (nonAdminUsers === 0 && totalOrders === 0 && totalMainOrders === 0 && totalSubOrders === 0) {
            console.log('✅ Database is already clean - no non-admin users or orders found.');
            return;
        }

        console.log('\n🧹 Starting cleanup process...');

        // Step 1: Remove all orders (this includes regular orders)
        console.log('\n1️⃣ Removing all Orders...');
        const deletedOrders = await Order.deleteMany({});
        console.log(`✅ Deleted ${deletedOrders.deletedCount} orders`);

        // Step 2: Remove all sub-orders
        console.log('\n2️⃣ Removing all SubOrders...');
        const deletedSubOrders = await SubOrder.deleteMany({});
        console.log(`✅ Deleted ${deletedSubOrders.deletedCount} sub-orders`);

        // Step 3: Remove all main orders
        console.log('\n3️⃣ Removing all MainOrders...');
        const deletedMainOrders = await MainOrder.deleteMany({});
        console.log(`✅ Deleted ${deletedMainOrders.deletedCount} main orders`);

        // Step 4: Remove all deliveries
        console.log('\n4️⃣ Removing all Deliveries...');
        const deletedDeliveries = await Delivery.deleteMany({});
        console.log(`✅ Deleted ${deletedDeliveries.deletedCount} deliveries`);

        // Step 5: Get list of non-admin users before deletion (for logging)
        console.log('\n5️⃣ Getting non-admin users...');
        const nonAdminUsersList = await User.find(
            { role: { $ne: 'admin' } },
            { username: 1, email: 1, role: 1, _id: 1 }
        );

        console.log(`Non-admin users to be deleted:`);
        nonAdminUsersList.forEach(user => {
            console.log(`- ${user.username} (${user.email}) - Role: ${user.role}`);
        });

        // Step 6: Remove all non-admin users
        console.log('\n6️⃣ Removing all non-admin users...');
        const deletedUsers = await User.deleteMany({ role: { $ne: 'admin' } });
        console.log(`✅ Deleted ${deletedUsers.deletedCount} non-admin users`);

        // Step 7: Verify cleanup
        console.log('\n📊 Verifying cleanup...');
        const remainingUsers = await User.countDocuments();
        const remainingAdminUsers = await User.countDocuments({ role: 'admin' });
        const remainingOrders = await Order.countDocuments();
        const remainingMainOrders = await MainOrder.countDocuments();
        const remainingSubOrders = await SubOrder.countDocuments();
        const remainingDeliveries = await Delivery.countDocuments();

        console.log(`\nFinal state:`);
        console.log(`- Remaining users: ${remainingUsers} (all admin)`);
        console.log(`- Remaining admin users: ${remainingAdminUsers}`);
        console.log(`- Remaining orders: ${remainingOrders}`);
        console.log(`- Remaining main orders: ${remainingMainOrders}`);
        console.log(`- Remaining sub orders: ${remainingSubOrders}`);
        console.log(`- Remaining deliveries: ${remainingDeliveries}`);

        // List remaining admin users
        const adminUsersList = await User.find(
            { role: 'admin' },
            { username: 1, email: 1, role: 1, createdAt: 1 }
        );

        console.log(`\nRemaining admin users:`);
        adminUsersList.forEach(user => {
            console.log(`- ${user.username} (${user.email}) - Created: ${user.createdAt || 'Unknown'}`);
        });

        console.log('\n✅ Database cleanup completed successfully!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

async function main() {
    try {
        await connectDatabase();
        await cleanupDatabase();
        console.log('\n🎉 Cleanup process completed successfully!');
    } catch (error) {
        console.error('\n💥 Cleanup process failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the cleanup
main();
