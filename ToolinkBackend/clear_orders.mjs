import mongoose from 'mongoose';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/toollink');

// Import models
const Order = mongoose.model('Order', {}, 'orders');
const MainOrder = mongoose.model('MainOrder', {}, 'mainorders');
const SubOrder = mongoose.model('SubOrder', {}, 'suborders');

console.log('🗑️ Clearing all existing orders...');

try {
    // Delete all orders and related data
    const orderDeleteResult = await Order.deleteMany({});
    console.log(`✅ Deleted ${orderDeleteResult.deletedCount} orders`);

    const mainOrderDeleteResult = await MainOrder.deleteMany({});
    console.log(`✅ Deleted ${mainOrderDeleteResult.deletedCount} main orders`);

    const subOrderDeleteResult = await SubOrder.deleteMany({});
    console.log(`✅ Deleted ${subOrderDeleteResult.deletedCount} sub orders`);

    console.log('🎯 All orders cleared successfully!');

} catch (error) {
    console.error('❌ Error clearing orders:', error);
} finally {
    await mongoose.disconnect();
    console.log('📡 Database connection closed');
}
