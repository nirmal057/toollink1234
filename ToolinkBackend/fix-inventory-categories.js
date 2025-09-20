// Script to fix inventory categorization issues based on item names
import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';

// MongoDB connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

// Smart categorization function based on item names
const categorizeByName = (name, description = '') => {
    const itemName = name.toLowerCase();
    const itemDesc = description.toLowerCase();

    // Cement and cement-related products
    if (itemName.includes('cement') || itemName.includes('concrete mix')) {
        return 'Cement';
    }

    // Steel and metal products
    if (itemName.includes('steel') || itemName.includes('iron') || itemName.includes('rebar') ||
        itemName.includes('reinforcement') || itemName.includes('mesh') || itemName.includes('rod') ||
        (itemName.includes('bar') && !itemName.includes('bar soap'))) {
        return 'Steel & Reinforcement';
    }

    // Paint and chemical products
    if (itemName.includes('paint') || itemName.includes('thinner') || itemName.includes('primer') ||
        itemName.includes('varnish') || itemName.includes('coating') || itemName.includes('adhesive') ||
        itemName.includes('glue') || itemName.includes('sealant') || itemName.includes('chemical')) {
        return 'Paint & Chemicals';
    }

    // Electrical items
    if (itemName.includes('electrical') || itemName.includes('wire') || itemName.includes('cable') ||
        itemName.includes('switch') || itemName.includes('socket') || itemName.includes('bulb') ||
        itemName.includes('led') || itemName.includes('tube light') || itemName.includes('conduit') ||
        (itemName.includes('fitting') && itemName.includes('electrical'))) {
        return 'Electrical Items';
    }

    // Plumbing supplies
    if (itemName.includes('pipe') || itemName.includes('pvc') || itemName.includes('valve') ||
        itemName.includes('tap') || itemName.includes('faucet') || itemName.includes('elbow') ||
        itemName.includes('reducer') || itemName.includes('coupling') || itemName.includes('plumbing') ||
        itemName.includes('drain') || itemName.includes('joint')) {
        return 'Plumbing Supplies';
    }

    // Tools and equipment
    if (itemName.includes('drill') || itemName.includes('hammer') || itemName.includes('saw') ||
        itemName.includes('screwdriver') || itemName.includes('wrench') || itemName.includes('tool') ||
        itemName.includes('cutter') || itemName.includes('grinder') || itemName.includes('level') ||
        itemName.includes('pliers') || itemName.includes('chisel')) {
        return 'Tools & Equipment';
    }

    // Hardware and fasteners
    if (itemName.includes('screw') || itemName.includes('nail') || itemName.includes('bolt') ||
        itemName.includes('nut') || itemName.includes('washer') || itemName.includes('fastener') ||
        itemName.includes('rivet') || itemName.includes('clip') || itemName.includes('bracket') ||
        itemName.includes('hinge') || itemName.includes('lock')) {
        return 'Hardware & Fasteners';
    }

    // Tiles and ceramics
    if (itemName.includes('tile') || itemName.includes('ceramic') || itemName.includes('porcelain') ||
        itemName.includes('mosaic') || itemName.includes('flooring')) {
        return 'Tiles & Ceramics';
    }

    // Roofing materials
    if (itemName.includes('roof') || itemName.includes('roofing') || itemName.includes('sheet') ||
        itemName.includes('zinc') || itemName.includes('asbestos') ||
        (itemName.includes('tile') && (itemName.includes('roof') || itemName.includes('clay'))) ||
        itemName.includes('gutter') || itemName.includes('ridge')) {
        return 'Roofing Materials';
    }

    // Safety equipment
    if (itemName.includes('helmet') || itemName.includes('glove') || itemName.includes('safety') ||
        itemName.includes('mask') || itemName.includes('goggles') || itemName.includes('vest') ||
        itemName.includes('harness') || itemName.includes('boot') || itemName.includes('protection')) {
        return 'Safety Equipment';
    }

    // Sand and aggregates
    if (itemName.includes('sand') || itemName.includes('gravel') || itemName.includes('aggregate') ||
        itemName.includes('chips') || itemName.includes('dust') || itemName.includes('crushed')) {
        return 'Sand & Aggregate';
    }

    // Traditional bricks (only clay bricks)
    if ((itemName.includes('brick') && !itemName.includes('block') && !itemName.includes('hollow')) ||
        (itemName.includes('red') && itemName.includes('brick')) ||
        (itemName.includes('clay') && itemName.includes('brick'))) {
        return 'Bricks';
    }

    // Concrete blocks and masonry products (separate from traditional bricks)
    if (itemName.includes('block') || itemName.includes('hollow') ||
        (itemName.includes('concrete') && (itemName.includes('block') || itemName.includes('slab') || itemName.includes('hollow')))) {
        return 'Masonry Blocks';
    }

    // Stones
    if (itemName.includes('stone') || itemName.includes('rock') || itemName.includes('pebble')) {
        return 'Stones';
    }

    // Default category for uncategorized items
    return 'Materials';
};

// Function to fix categorization in the database
const fixCategorization = async () => {
    try {
        await connectDB();

        console.log('🔄 Starting inventory categorization fix...');

        // Get all inventory items
        const items = await Inventory.find({});
        console.log(`📦 Found ${items.length} inventory items`);

        let updatedCount = 0;
        const updates = [];

        for (const item of items) {
            const newCategory = categorizeByName(item.name, item.description);

            if (item.category !== newCategory) {
                updates.push({
                    name: item.name,
                    oldCategory: item.category,
                    newCategory: newCategory
                });

                // Update the item in database
                await Inventory.findByIdAndUpdate(item._id, { category: newCategory });
                updatedCount++;
            }
        }

        console.log('\n📋 Categorization Changes:');
        console.log('=========================');

        if (updates.length === 0) {
            console.log('✅ No categorization changes needed - all items are correctly categorized!');
        } else {
            updates.forEach((update, index) => {
                console.log(`${index + 1}. "${update.name}"`);
                console.log(`   Old: ${update.oldCategory} → New: ${update.newCategory}`);
                console.log('');
            });

            console.log(`\n✅ Successfully updated ${updatedCount} items`);
        }

        // Display final category distribution
        const categoryStats = await Inventory.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\n📊 Final Category Distribution:');
        console.log('===============================');
        categoryStats.forEach(stat => {
            console.log(`${stat._id}: ${stat.count} items`);
        });

    } catch (error) {
        console.error('❌ Error fixing categorization:', error);
    } finally {
        mongoose.disconnect();
        console.log('\n🎉 Categorization fix completed!');
    }
};

// Run the categorization fix
fixCategorization();
