import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';
import Material from './src/models/Material.js';
import logger from './src/utils/logger.js';

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for migration');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Warehouse code mapping based on categories and existing warehouse fields
const warehouseCodeMapping = {
    'warehouse1': 'W1',  // Sand & Aggregates
    'warehouse2': 'W2',  // Bricks & Masonry
    'warehouse3': 'W3',  // Steel & Metal
    'main_warehouse': 'WM' // Tools & Equipment
};

// Category to warehouse code mapping
const categoryToWarehouseCode = {
    // W1 - Sand & Aggregates
    'Sand & Aggregate': 'W1',
    'Fine Sand': 'W1',
    'Medium Sand': 'W1',
    'Coarse Sand': 'W1',
    'River Sand': 'W1',
    'Washed Sand': 'W1',
    'M-Sand (Crushed Rock)': 'W1',
    'Aggregate': 'W1',
    'Gravel': 'W1',
    'Stone Chips': 'W1',
    'Aggregates': 'W1',

    // W2 - Bricks & Masonry
    'Bricks & Blocks': 'W2',
    'Solid Cement Blocks': 'W2',
    'Hollow Cement Blocks': 'W2',
    'Clay Bricks': 'W2',
    '4 Inch Blocks': 'W2',
    '6 Inch Blocks': 'W2',
    '8 Inch Blocks': 'W2',
    'Interlocking Pavers': 'W2',
    'Granite Slabs': 'W2',
    'Decorative Stones': 'W2',
    'Bricks': 'W2',
    'Masonry Blocks': 'W2',
    'Stones': 'W2',

    // W3 - Steel & Metal
    'Steel & Reinforcement': 'W3',
    '6mm Steel Rods': 'W3',
    '8mm Steel Rods': 'W3',
    '10mm Steel Rods': 'W3',
    '12mm Steel Rods': 'W3',
    '16mm Steel Rods': 'W3',
    '20mm Steel Rods': 'W3',
    '25mm Steel Rods': 'W3',
    'Binding Wire 5kg': 'W3',
    'Binding Wire 10kg': 'W3',
    'Binding Wire 20kg': 'W3',
    'Steel Mesh': 'W3',
    'Expanded Metal': 'W3',

    // WM - Tools & Equipment (default for others)
    'Tools & Equipment': 'WM',
    'Hand Tools': 'WM',
    'Power Tools': 'WM',
    'Measuring Tools': 'WM',
    'Safety Equipment': 'WM',
    'Construction Equipment': 'WM',
    'Hardware': 'WM',
    'Cement': 'WM',
    'Paint & Chemicals': 'WM',
    'Electrical Items': 'WM',
    'Plumbing Supplies': 'WM',
    'Hardware & Fasteners': 'WM',
    'Tiles & Ceramics': 'WM',
    'Roofing Materials': 'WM',
    'Materials': 'WM'
};

async function migrateInventoryWarehouseCodes() {
    try {
        console.log('Starting inventory warehouseCode migration...');

        // Get all inventory items without warehouseCode
        const inventoryItems = await Inventory.find({
            $or: [
                { warehouseCode: { $exists: false } },
                { warehouseCode: null },
                { warehouseCode: '' }
            ]
        });

        console.log(`Found ${inventoryItems.length} inventory items to update`);

        let updated = 0;
        let skipped = 0;

        for (const item of inventoryItems) {
            let warehouseCode = null;

            // First try to map from existing warehouse field
            if (item.warehouse && warehouseCodeMapping[item.warehouse]) {
                warehouseCode = warehouseCodeMapping[item.warehouse];
            }
            // Then try to map from category
            else if (item.category && categoryToWarehouseCode[item.category]) {
                warehouseCode = categoryToWarehouseCode[item.category];
            }
            // Default to WM (main warehouse)
            else {
                warehouseCode = 'WM';
            }

            try {
                await Inventory.updateOne(
                    { _id: item._id },
                    {
                        $set: {
                            warehouseCode: warehouseCode
                        }
                    }
                );

                console.log(`Updated inventory item: ${item.name} -> ${warehouseCode}`);
                updated++;
            } catch (error) {
                console.error(`Failed to update inventory item ${item._id}:`, error);
                skipped++;
            }
        }

        console.log(`Inventory migration completed: ${updated} updated, ${skipped} skipped`);
        return { updated, skipped };

    } catch (error) {
        console.error('Inventory migration error:', error);
        throw error;
    }
}

async function migrateMaterialWarehouseCodes() {
    try {
        console.log('Starting material warehouseCode migration...');

        // Get all materials without warehouseCode
        const materials = await Material.find({
            $or: [
                { warehouseCode: { $exists: false } },
                { warehouseCode: null },
                { warehouseCode: '' }
            ]
        });

        console.log(`Found ${materials.length} materials to update`);

        let updated = 0;
        let skipped = 0;

        for (const material of materials) {
            let warehouseCode = null;

            // Map from category
            if (material.category && categoryToWarehouseCode[material.category]) {
                warehouseCode = categoryToWarehouseCode[material.category];
            }
            // Default to WM (main warehouse)
            else {
                warehouseCode = 'WM';
            }

            try {
                await Material.updateOne(
                    { _id: material._id },
                    {
                        $set: {
                            warehouseCode: warehouseCode
                        }
                    }
                );

                console.log(`Updated material: ${material.name} -> ${warehouseCode}`);
                updated++;
            } catch (error) {
                console.error(`Failed to update material ${material._id}:`, error);
                skipped++;
            }
        }

        console.log(`Material migration completed: ${updated} updated, ${skipped} skipped`);
        return { updated, skipped };

    } catch (error) {
        console.error('Material migration error:', error);
        throw error;
    }
}

async function addUniqueIdsToInventory() {
    try {
        console.log('Adding unique IDs to existing inventory items...');

        // Get all inventory items
        const inventoryItems = await Inventory.find({});
        console.log(`Found ${inventoryItems.length} inventory items`);

        let updated = 0;

        for (const item of inventoryItems) {
            // Generate SKU if it doesn't exist
            if (!item.sku) {
                const warehousePrefix = item.warehouseCode || 'WM';
                const timestamp = Date.now().toString().slice(-6);
                const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
                const sku = `${warehousePrefix}-${timestamp}-${randomSuffix}`;

                try {
                    await Inventory.updateOne(
                        { _id: item._id },
                        {
                            $set: {
                                sku: sku
                            }
                        }
                    );

                    console.log(`Added SKU to inventory item: ${item.name} -> ${sku}`);
                    updated++;
                } catch (error) {
                    console.error(`Failed to update inventory item ${item._id}:`, error);
                }
            }
        }

        console.log(`SKU generation completed: ${updated} updated`);
        return updated;

    } catch (error) {
        console.error('SKU generation error:', error);
        throw error;
    }
}

async function runMigration() {
    try {
        await connectDB();

        console.log('='.repeat(50));
        console.log('STARTING WAREHOUSE CODE MIGRATION');
        console.log('='.repeat(50));

        // Step 1: Migrate inventory warehouse codes
        const inventoryResult = await migrateInventoryWarehouseCodes();

        console.log('\n' + '-'.repeat(30));

        // Step 2: Migrate material warehouse codes
        const materialResult = await migrateMaterialWarehouseCodes();

        console.log('\n' + '-'.repeat(30));

        // Step 3: Add unique IDs/SKUs to existing inventory
        const skuResult = await addUniqueIdsToInventory();

        console.log('\n' + '='.repeat(50));
        console.log('MIGRATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`Inventory items updated with warehouseCode: ${inventoryResult.updated}`);
        console.log(`Materials updated with warehouseCode: ${materialResult.updated}`);
        console.log(`Inventory items updated with SKU: ${skuResult}`);
        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    }
}

// Run the migration
runMigration();
