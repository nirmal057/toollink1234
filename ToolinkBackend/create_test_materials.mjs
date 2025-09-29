import mongoose from 'mongoose';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/toollink');

console.log('🏗️ Creating test materials for warehouse separation...');

// Create Material schema
const materialSchema = new mongoose.Schema({
    name: String,
    category: String,
    unit: String,
    warehouseCode: String,
    isActive: Boolean
});

const Material = mongoose.model('Material', materialSchema, 'materials');

// Clear existing materials
await Material.deleteMany({});

// Also clear the collection completely to remove any orphaned documents
const db = mongoose.connection.db;
try {
    await db.collection('materials').drop();
    console.log('Materials collection dropped');
} catch (error) {
    console.log('Materials collection does not exist or already empty');
}

// Create materials for each warehouse - specific items requested
const materials = [
    // W1 - Sand & Aggregates (Kelani River Sand - Fine)
    { name: 'Kelani River Sand - Fine', category: 'Aggregates', unit: 'ton', sku: 'W1-KRSF001', warehouseCode: 'W1', isActive: true },

    // W2 - Blocks & Masonry (Clay Brick - Solid)
    { name: 'Clay Brick - Solid', category: 'Bricks & Blocks', unit: 'piece', sku: 'W2-CBS001', warehouseCode: 'W2', isActive: true },

    // W3 - Steel & Metal (Binding Wire 20kg)
    { name: 'Binding Wire 20kg', category: 'Steel & Reinforcement', unit: 'kg', sku: 'W3-BW20001', warehouseCode: 'W3', isActive: true },

    // Additional materials for other warehouses
    { name: 'River Sand', category: 'Aggregates', unit: 'ton', sku: 'W1-RS001', warehouseCode: 'W1', isActive: true },
    { name: 'Concrete Blocks', category: 'Bricks & Blocks', unit: 'piece', sku: 'W2-CB001', warehouseCode: 'W2', isActive: true },
    { name: 'Steel Rods', category: 'Steel & Reinforcement', unit: 'kg', sku: 'W3-SR001', warehouseCode: 'W3', isActive: true },
    { name: 'Power Tools', category: 'Tools & Equipment', unit: 'piece', sku: 'WM-PT001', warehouseCode: 'WM', isActive: true }
]; try {
    const createdMaterials = await Material.insertMany(materials);
    console.log(`✅ Created ${createdMaterials.length} materials:`);
    createdMaterials.forEach(material => {
        console.log(`   ${material.name} (${material.warehouseCode}) - ID: ${material._id}`);
    });

    console.log('🎯 Materials created successfully!');

} catch (error) {
    console.error('❌ Error creating materials:', error);
} finally {
    await mongoose.disconnect();
    console.log('📡 Database connection closed');
}
