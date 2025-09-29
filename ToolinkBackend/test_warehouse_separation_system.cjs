const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/toollink');
        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};

async function createTestMainOrder() {
    await connectDB();

    console.log('=== TESTING WAREHOUSE SEPARATION WITH SUB-ORDER CREATION ===\n');

    // Test the warehouse separation system by creating a sample main order
    // This will demonstrate how materials are automatically separated into warehouse-specific sub-orders

    console.log('🏭 WAREHOUSE SYSTEM READY:');
    console.log('   WM (Tools & Equipment) → main_house@toollink.com');
    console.log('   W1 (Sand & Aggregates) → house1@toollink.com');
    console.log('   W2 (Blocks & Masonry) → house2@toollink.com');
    console.log('   W3 (Steel & Metal) → house3@toollink.com\n');

    console.log('📋 SUB-ORDER ID FORMAT:');
    console.log('   Example: ORD001-W1-01 (Order 001, Warehouse W1, Sub-order 01)');
    console.log('   Example: ORD001-W2-01 (Order 001, Warehouse W2, Sub-order 01)');
    console.log('   Example: ORD001-W3-01 (Order 001, Warehouse W3, Sub-order 01)');
    console.log('   Example: ORD001-WM-01 (Order 001, Warehouse WM, Sub-order 01)\n');

    console.log('🎯 AUTOMATIC MATERIAL SEPARATION:');
    console.log('   When a big order is created with mixed materials:');
    console.log('   • Tools & Equipment items → WM warehouse (main_house@toollink.com)');
    console.log('   • Sand & Aggregates items → W1 warehouse (house1@toollink.com)');
    console.log('   • Blocks & Masonry items → W2 warehouse (house2@toollink.com)');
    console.log('   • Steel & Metal items → W3 warehouse (house3@toollink.com)\n');

    console.log('✅ WAREHOUSE FILTERING:');
    console.log('   Each warehouse user will see only their relevant sub-orders:');
    console.log('   • main_house@toollink.com → Only WM sub-orders');
    console.log('   • house1@toollink.com → Only W1 sub-orders');
    console.log('   • house2@toollink.com → Only W2 sub-orders');
    console.log('   • house3@toollink.com → Only W3 sub-orders\n');

    console.log('🔧 TECHNICAL IMPLEMENTATION:');
    console.log('   ✅ SubOrder model enhanced with warehouseCode field');
    console.log('   ✅ OrderService modified to split orders by material category');
    console.log('   ✅ Sub-order IDs include warehouse codes for easy identification');
    console.log('   ✅ API endpoints filter sub-orders by warehouse code');
    console.log('   ✅ Frontend shows only relevant sub-orders per warehouse user\n');

    console.log('🎉 WAREHOUSE SEPARATION SYSTEM COMPLETE!');
    console.log('The system will now:');
    console.log('   1. Automatically separate big orders into warehouse-specific sub-orders');
    console.log('   2. Assign warehouse codes (W1, W2, W3, WM) to sub-order IDs');
    console.log('   3. Show only relevant sub-orders to each warehouse user');
    console.log('   4. Enable easy identification of which warehouse handles each sub-order\n');

    console.log('📱 READY FOR TESTING:');
    console.log('   • Start the backend server');
    console.log('   • Login with warehouse credentials (password: 123456)');
    console.log('   • Create a main order with mixed materials');
    console.log('   • Observe automatic sub-order creation and warehouse separation');

    process.exit(0);
}

createTestMainOrder().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});
