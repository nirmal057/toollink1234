import mongoose from 'mongoose';
import Warehouse from './src/models/Warehouse.js';

const updateWarehouseCodes = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to database');

        // Get existing warehouses
        const warehouses = await Warehouse.find({});
        console.log(`📍 Found ${warehouses.length} warehouses to update:`);

        // Define warehouse name to code mapping
        const warehouseMapping = {
            'Sand & Aggregate': 'W1',
            'Bricks & Masonry': 'W2',
            'Steel & Metal': 'W3',
            'Main Warehouse': 'WM'
        };

        let updated = 0;

        for (const warehouse of warehouses) {
            console.log(`📦 Processing: ${warehouse.name}`);

            const code = warehouseMapping[warehouse.name];
            if (code) {
                try {
                    await Warehouse.updateOne(
                        { _id: warehouse._id },
                        { $set: { code: code } }
                    );
                    console.log(`  ✅ Updated with code: ${code}`);
                    updated++;
                } catch (error) {
                    console.error(`  ❌ Failed to update: ${error.message}`);
                }
            } else {
                console.log(`  ⚠️  No code mapping found for: ${warehouse.name}`);
            }
        }

        // Verify the updates
        const updatedWarehouses = await Warehouse.find({});
        console.log(`\n📊 Verification - Updated warehouses:`);
        updatedWarehouses.forEach(wh => {
            console.log(`  - ${wh.name}: ${wh.code || 'NO CODE'}`);
        });

        console.log(`\n✅ Updated ${updated} warehouses with codes`);

        mongoose.connection.close();

    } catch (error) {
        console.error('❌ Error:', error.message);
        mongoose.connection.close();
    }
};

updateWarehouseCodes();
