// Script to analyze all inventory items and recategorize them based on their actual names
import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';

// Use local MongoDB connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Comprehensive categorization function based on item names
const categorizeByItemName = (name, description = '') => {
    const itemName = name.toLowerCase();
    const itemDesc = description.toLowerCase();
    const fullText = `${itemName} ${itemDesc}`;

    // CEMENT - All cement products
    if (fullText.includes('cement') || fullText.includes('concrete mix') || fullText.includes('portland')) {
        return 'Cement';
    }

    // STEEL & REINFORCEMENT - All steel products
    if (fullText.includes('steel') || fullText.includes('rebar') || fullText.includes('reinforcement') ||
        fullText.includes('iron') || (fullText.includes('bar') && (fullText.includes('steel') || fullText.includes('mm'))) ||
        fullText.includes('mesh') && fullText.includes('steel')) {
        return 'Steel & Reinforcement';
    }

    // PAINT & CHEMICALS - All paint and chemical products
    if (fullText.includes('paint') || fullText.includes('primer') || fullText.includes('coating') ||
        fullText.includes('varnish') || fullText.includes('thinner') || fullText.includes('sealer') ||
        fullText.includes('adhesive') || fullText.includes('chemical') || fullText.includes('glue')) {
        return 'Paint & Chemicals';
    }

    // ELECTRICAL ITEMS - All electrical products
    if (fullText.includes('electrical') || fullText.includes('electric') || fullText.includes('wire') ||
        fullText.includes('cable') || fullText.includes('switch') || fullText.includes('socket') ||
        fullText.includes('bulb') || fullText.includes('led') || fullText.includes('conduit') ||
        fullText.includes('light') || fullText.includes('fitting') && fullText.includes('electrical')) {
        return 'Electrical Items';
    }

    // PLUMBING SUPPLIES - All plumbing products
    if (fullText.includes('pipe') || fullText.includes('pvc') || fullText.includes('valve') ||
        fullText.includes('tap') || fullText.includes('plumbing') || fullText.includes('drain') ||
        fullText.includes('joint') || fullText.includes('elbow') || fullText.includes('coupling') ||
        fullText.includes('brass') && (fullText.includes('valve') || fullText.includes('fitting'))) {
        return 'Plumbing Supplies';
    }

    // TOOLS & EQUIPMENT - All tools
    if (fullText.includes('drill') || fullText.includes('hammer') || fullText.includes('saw') ||
        fullText.includes('tool') || fullText.includes('wrench') || fullText.includes('screwdriver') ||
        fullText.includes('measuring tape') || fullText.includes('level') || fullText.includes('grinder') ||
        fullText.includes('cutter') || fullText.includes('pliers') || fullText.includes('set') && fullText.includes('tool')) {
        return 'Tools & Equipment';
    }

    // HARDWARE & FASTENERS - Screws, nails, bolts, etc.
    if (fullText.includes('screw') || fullText.includes('nail') || fullText.includes('bolt') ||
        fullText.includes('nut') || fullText.includes('washer') || fullText.includes('fastener') ||
        fullText.includes('lock') && fullText.includes('door') || fullText.includes('hinge') ||
        fullText.includes('bracket') || fullText.includes('clip')) {
        return 'Hardware & Fasteners';
    }

    // TILES & CERAMICS - All tiles and ceramic products
    if (fullText.includes('tile') || fullText.includes('ceramic') || fullText.includes('marble') ||
        fullText.includes('granite') && fullText.includes('slab') || fullText.includes('mosaic') ||
        fullText.includes('flooring') || fullText.includes('wall') && fullText.includes('tile')) {
        return 'Tiles & Ceramics';
    }

    // ROOFING MATERIALS - All roofing products
    if (fullText.includes('roof') || fullText.includes('sheet') && (fullText.includes('iron') || fullText.includes('metal')) ||
        fullText.includes('corrugated') || fullText.includes('zinc') || fullText.includes('gutter') ||
        (fullText.includes('tile') && fullText.includes('clay')) || fullText.includes('ridge')) {
        return 'Roofing Materials';
    }

    // SAFETY EQUIPMENT - All safety products
    if (fullText.includes('safety') || fullText.includes('helmet') || fullText.includes('glove') ||
        fullText.includes('goggles') || fullText.includes('mask') || fullText.includes('vest') ||
        fullText.includes('protection') || fullText.includes('harness') || fullText.includes('boot')) {
        return 'Safety Equipment';
    }

    // SAND & AGGREGATE - All sand and aggregate materials
    if (fullText.includes('sand') || fullText.includes('gravel') || fullText.includes('aggregate') ||
        fullText.includes('stone') && (fullText.includes('crushed') || fullText.includes('20mm') || fullText.includes('cube')) ||
        fullText.includes('chips') || fullText.includes('dust')) {
        return 'Sand & Aggregate';
    }

    // BRICKS - Traditional clay bricks only
    if ((fullText.includes('brick') && fullText.includes('clay')) ||
        (fullText.includes('brick') && fullText.includes('red')) ||
        (fullText.includes('brick') && !fullText.includes('block') && !fullText.includes('concrete'))) {
        return 'Bricks';
    }

    // MASONRY BLOCKS - Concrete blocks, hollow blocks
    if (fullText.includes('block') || fullText.includes('hollow') ||
        (fullText.includes('concrete') && fullText.includes('block')) ||
        fullText.includes('masonry') || fullText.includes('cinder')) {
        return 'Masonry Blocks';
    }

    // STONES - Natural stones, limestone, granite blocks
    if ((fullText.includes('stone') && !fullText.includes('crushed') && !fullText.includes('aggregate')) ||
        fullText.includes('limestone') || fullText.includes('granite') && fullText.includes('block') ||
        fullText.includes('marble') && fullText.includes('block') || fullText.includes('rock')) {
        return 'Stones';
    }

    // Default to Materials for anything else
    return 'Materials';
};

// Function to recategorize all items
const recategorizeAllItems = async () => {
    try {
        await connectDB();

        console.log('🔄 Starting comprehensive inventory recategorization...');

        // Get all inventory items
        const items = await Inventory.find({}).select('_id name description category');
        console.log(`📦 Found ${items.length} inventory items`);

        console.log('\n📋 Current Items and Suggested Categories:');
        console.log('==========================================');

        let updatedCount = 0;
        const updates = [];

        // Analyze each item
        for (const item of items) {
            const currentCategory = item.category;
            const suggestedCategory = categorizeByItemName(item.name, item.description);

            console.log(`\n"${item.name}"`);
            console.log(`  Description: ${item.description || 'N/A'}`);
            console.log(`  Current: ${currentCategory}`);
            console.log(`  Suggested: ${suggestedCategory}`);

            if (currentCategory !== suggestedCategory) {
                console.log(`  🔄 NEEDS UPDATE: ${currentCategory} → ${suggestedCategory}`);

                updates.push({
                    id: item._id,
                    name: item.name,
                    description: item.description,
                    oldCategory: currentCategory,
                    newCategory: suggestedCategory
                });
            } else {
                console.log(`  ✅ CORRECT`);
            }
        }

        // Show summary of needed updates
        console.log('\n\n📊 Update Summary:');
        console.log('==================');

        if (updates.length === 0) {
            console.log('✅ All items are correctly categorized!');
        } else {
            console.log(`🔄 ${updates.length} items need recategorization:\n`);

            updates.forEach((update, index) => {
                console.log(`${index + 1}. "${update.name}"`);
                console.log(`   ${update.oldCategory} → ${update.newCategory}`);
            });

            // Ask for confirmation and apply updates
            console.log(`\n🔧 Applying ${updates.length} category updates...`);

            for (const update of updates) {
                await Inventory.findByIdAndUpdate(update.id, { category: update.newCategory });
                updatedCount++;
                console.log(`✅ Updated "${update.name}"`);
            }

            console.log(`\n✅ Successfully updated ${updatedCount} items!`);
        }

        // Show final category distribution
        const categoryStats = await Inventory.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 }, items: { $push: '$name' } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\n📊 Final Category Distribution:');
        console.log('===============================');
        categoryStats.forEach(stat => {
            console.log(`\n${stat._id}: ${stat.count} items`);
            // Show all items in each category
            stat.items.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item}`);
            });
        });

    } catch (error) {
        console.error('❌ Error recategorizing items:', error);
    } finally {
        mongoose.disconnect();
        console.log('\n🎉 Recategorization completed!');
    }
};

// Run the recategorization
recategorizeAllItems();
