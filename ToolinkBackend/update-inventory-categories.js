// Script to update specific inventory items with correct categories
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

// Specific categorization fixes based on item names
const specificFixes = [
    {
        itemName: 'Hollow Blocks',
        newCategory: 'Masonry Blocks',
        reason: 'Concrete blocks should be in Masonry Blocks, not Bricks'
    },
    {
        itemName: 'Concrete Blocks',
        newCategory: 'Masonry Blocks',
        reason: 'Concrete blocks should be in Masonry Blocks, not Bricks'
    },
    {
        itemNamePattern: /concrete.*block/i,
        newCategory: 'Masonry Blocks',
        reason: 'Any concrete blocks should be in Masonry Blocks'
    },
    {
        itemNamePattern: /hollow.*block/i,
        newCategory: 'Masonry Blocks',
        reason: 'Hollow blocks are concrete masonry, not traditional bricks'
    },
    {
        itemNamePattern: /cinder.*block/i,
        newCategory: 'Masonry Blocks',
        reason: 'Cinder blocks are masonry blocks'
    },
    {
        itemNamePattern: /masonry.*block/i,
        newCategory: 'Masonry Blocks',
        reason: 'Masonry blocks category'
    }
];

// Function to apply categorization fixes
const applyCategoryFixes = async () => {
    try {
        await connectDB();

        console.log('🔄 Starting inventory category fixes...');

        // Get all inventory items
        const items = await Inventory.find({});
        console.log(`📦 Found ${items.length} inventory items`);

        let updatedCount = 0;
        const updates = [];

        for (const item of items) {
            let newCategory = null;
            let reason = '';

            // Check each fix rule
            for (const fix of specificFixes) {
                if (fix.itemName && item.name.toLowerCase().includes(fix.itemName.toLowerCase())) {
                    newCategory = fix.newCategory;
                    reason = fix.reason;
                    break;
                } else if (fix.itemNamePattern && fix.itemNamePattern.test(item.name)) {
                    newCategory = fix.newCategory;
                    reason = fix.reason;
                    break;
                }
            }

            // Apply fix if needed
            if (newCategory && item.category !== newCategory) {
                updates.push({
                    name: item.name,
                    oldCategory: item.category,
                    newCategory: newCategory,
                    reason: reason
                });

                // Update in database
                await Inventory.findByIdAndUpdate(item._id, { category: newCategory });
                updatedCount++;

                console.log(`✅ Updated "${item.name}": ${item.category} → ${newCategory}`);
            }
        }

        // Display summary
        console.log('\n📋 Category Update Summary:');
        console.log('==========================');

        if (updates.length === 0) {
            console.log('✅ No category updates needed - all items are correctly categorized!');
        } else {
            console.log(`✅ Successfully updated ${updatedCount} items:\n`);

            updates.forEach((update, index) => {
                console.log(`${index + 1}. "${update.name}"`);
                console.log(`   Old: ${update.oldCategory} → New: ${update.newCategory}`);
                console.log(`   Reason: ${update.reason}`);
                console.log('');
            });
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
            // Show first few items in each category
            const itemList = stat.items.slice(0, 3).join(', ');
            const remaining = stat.count > 3 ? ` (and ${stat.count - 3} more...)` : '';
            console.log(`   Items: ${itemList}${remaining}`);
        });

    } catch (error) {
        console.error('❌ Error applying category fixes:', error);
    } finally {
        mongoose.disconnect();
        console.log('\n🎉 Category fixes completed!');
    }
};

// Run the fixes
applyCategoryFixes();
