import mongoose from 'mongoose';
import Warehouse from './src/models/Warehouse.js';

const checkAndCreateWarehouses = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to database');

        // Check existing warehouses
        const existingWarehouses = await Warehouse.find({});
        console.log(`📍 Found ${existingWarehouses.length} existing warehouses:`);
        existingWarehouses.forEach(wh => {
            console.log(`  - ${wh.name} (Code: ${wh.code})`);
        });

        // Define required warehouses
        const requiredWarehouses = [
            {
                name: 'Sand & Aggregates Warehouse',
                code: 'W1',
                description: 'Warehouse for sand, aggregates, gravel and stone materials',
                location: 'Section A',
                capacity: 5000,
                isActive: true
            },
            {
                name: 'Bricks & Masonry Warehouse',
                code: 'W2',
                description: 'Warehouse for bricks, blocks, pavers and masonry materials',
                location: 'Section B',
                capacity: 3000,
                isActive: true
            },
            {
                name: 'Steel & Metal Warehouse',
                code: 'W3',
                description: 'Warehouse for steel rods, wire mesh, metal materials',
                location: 'Section C',
                capacity: 2000,
                isActive: true
            },
            {
                name: 'Tools & Equipment Warehouse',
                code: 'WM',
                description: 'Warehouse for tools, hardware, cement and miscellaneous items',
                location: 'Section D',
                capacity: 4000,
                isActive: true
            }
        ];

        let created = 0;

        for (const warehouseData of requiredWarehouses) {
            const exists = existingWarehouses.find(wh => wh.code === warehouseData.code);

            if (!exists) {
                console.log(`📦 Creating warehouse: ${warehouseData.name} (${warehouseData.code})`);

                try {
                    const warehouse = new Warehouse(warehouseData);
                    await warehouse.save();
                    console.log(`  ✅ Created successfully`);
                    created++;
                } catch (error) {
                    console.error(`  ❌ Failed to create: ${error.message}`);
                }
            } else {
                console.log(`  ℹ️  Warehouse ${warehouseData.code} already exists`);
            }
        }

        // Verify final state
        const finalWarehouses = await Warehouse.find({});
        console.log(`\n📊 Final warehouse count: ${finalWarehouses.length}`);
        console.log('Warehouses in database:');
        finalWarehouses.forEach(wh => {
            console.log(`  - ${wh.name} (${wh.code}) - ${wh.location}`);
        });

        console.log(`\n✅ Created ${created} new warehouses`);

        mongoose.connection.close();

    } catch (error) {
        console.error('❌ Error:', error.message);
        mongoose.connection.close();
    }
};

checkAndCreateWarehouses();
