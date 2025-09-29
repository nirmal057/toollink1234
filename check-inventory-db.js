import mongoose from 'mongoose';
import Inventory from './ToolinkBackend/src/models/Inventory.js';

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for checking inventory');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const checkInventory = async () => {
    try {
        await connectDB();

        console.log('Checking current inventory items...\n');

        const inventoryItems = await Inventory.find({}).limit(10);

        console.log(`Found ${inventoryItems.length} inventory items:`);
        console.log('=====================================');

        inventoryItems.forEach((item, index) => {
            console.log(`${index + 1}. Name: ${item.name}`);
            console.log(`   Category: ${item.category}`);
            console.log(`   Location: ${item.location}`);
            console.log(`   Warehouse: ${item.warehouse}`);
            console.log(`   Warehouse Code: ${item.warehouseCode}`);
            console.log('   -------------------');
        });

        // Count by location
        const locationCounts = await Inventory.aggregate([
            { $group: { _id: '$location', count: { $sum: 1 } } }
        ]);

        console.log('\nItems by Location:');
        locationCounts.forEach(loc => {
            console.log(`${loc._id}: ${loc.count} items`);
        });

        // Count by category
        const categoryCounts = await Inventory.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        console.log('\nItems by Category:');
        categoryCounts.forEach(cat => {
            console.log(`${cat._id}: ${cat.count} items`);
        });

        mongoose.connection.close();
    } catch (error) {
        console.error('Error checking inventory:', error);
        mongoose.connection.close();
    }
};

checkInventory();
