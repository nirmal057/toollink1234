import mongoose from 'mongoose';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/toollink');

console.log('🏪 Creating test warehouses...');

// Create Warehouse schema
const warehouseSchema = new mongoose.Schema({
    code: String,
    name: String,
    location: String,
    phone: String,
    isActive: Boolean
});

const Warehouse = mongoose.model('Warehouse', warehouseSchema, 'warehouses');

// Clear existing warehouses
await Warehouse.deleteMany({});

// Create warehouses
const warehouses = [
    { code: 'W1', name: 'Sand & Aggregates Warehouse', location: 'Location W1', phone: '+94711111111', isActive: true },
    { code: 'W2', name: 'Blocks & Masonry Warehouse', location: 'Location W2', phone: '+94722222222', isActive: true },
    { code: 'W3', name: 'Steel & Metal Warehouse', location: 'Location W3', phone: '+94733333333', isActive: true },
    { code: 'WM', name: 'Tools & Equipment Warehouse', location: 'Main Location', phone: '+94744444444', isActive: true }
];

try {
    const createdWarehouses = await Warehouse.insertMany(warehouses);
    console.log(`✅ Created ${createdWarehouses.length} warehouses:`);
    createdWarehouses.forEach(warehouse => {
        console.log(`   ${warehouse.code}: ${warehouse.name} - ID: ${warehouse._id}`);
    });

    console.log('🎯 Warehouses created successfully!');

} catch (error) {
    console.error('❌ Error creating warehouses:', error);
} finally {
    await mongoose.disconnect();
    console.log('📡 Database connection closed');
}
