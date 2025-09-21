import mongoose from 'mongoose';
import { config } from 'dotenv';
import Inventory from './src/models/Inventory.js';
import logger from './src/utils/logger.js';

// Load environment variables
config();

async function assignInventoryToWarehouses() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink_new');
        console.log('✅ Connected to MongoDB');

        // Define category to warehouse mapping
        const categoryWarehouseMap = {
            // Warehouse1 - River sand/soil
            'Sand & Aggregate': 'warehouse1',

            // Warehouse2 - Bricks
            'Bricks': 'warehouse2',
            'Masonry Blocks': 'warehouse2',
            'Stones': 'warehouse2',

            // Warehouse3 - Metals
            'Steel & Reinforcement': 'warehouse3',

            // Main Warehouse - Tools & Equipment and others
            'Tools & Equipment': 'main_warehouse',
            'Cement': 'main_warehouse',
            'Paint & Chemicals': 'main_warehouse',
            'Electrical Items': 'main_warehouse',
            'Plumbing Supplies': 'main_warehouse',
            'Hardware & Fasteners': 'main_warehouse',
            'Tiles & Ceramics': 'main_warehouse',
            'Roofing Materials': 'main_warehouse',
            'Safety Equipment': 'main_warehouse',
            'Materials': 'main_warehouse',
            'Other': 'main_warehouse'
        };

        console.log('\n🏭 Starting warehouse assignment...');

        // Get all inventory items
        const inventoryItems = await Inventory.find({});
        console.log(`Found ${inventoryItems.length} inventory items to update`);

        let updatedCount = 0;
        let errors = [];

        for (const item of inventoryItems) {
            try {
                const warehouseAssignment = categoryWarehouseMap[item.category] || 'main_warehouse';

                await Inventory.findByIdAndUpdate(
                    item._id,
                    { warehouse: warehouseAssignment },
                    { new: true }
                );

                console.log(`✅ Updated ${item.name} (${item.category}) → ${warehouseAssignment}`);
                updatedCount++;
            } catch (error) {
                console.error(`❌ Error updating ${item.name}:`, error.message);
                errors.push({ item: item.name, error: error.message });
            }
        }

        console.log(`\n📊 Assignment Summary:`);
        console.log(`✅ Successfully updated: ${updatedCount} items`);
        console.log(`❌ Errors: ${errors.length} items`);

        if (errors.length > 0) {
            console.log('\n❌ Error Details:');
            errors.forEach(err => {
                console.log(`  - ${err.item}: ${err.error}`);
            });
        }

        // Show warehouse breakdown
        console.log('\n🏪 Warehouse Assignment Breakdown:');
        const warehouseBreakdown = await Inventory.aggregate([
            {
                $group: {
                    _id: '$warehouse',
                    count: { $sum: 1 },
                    categories: { $addToSet: '$category' }
                }
            }
        ]);

        warehouseBreakdown.forEach(warehouse => {
            console.log(`  ${warehouse._id}: ${warehouse.count} items`);
            warehouse.categories.forEach(category => {
                console.log(`    - ${category}`);
            });
        });

        console.log('\n✅ Warehouse assignment completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        logger.error('Warehouse assignment error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the migration
assignInventoryToWarehouses();
