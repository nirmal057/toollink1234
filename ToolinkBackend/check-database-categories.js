import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';

async function checkCategories() {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink_inventory');
        console.log('Connected to database');

        const categories = await Inventory.distinct('category');
        console.log('\nCategories currently in database:');
        console.log('='.repeat(40));
        categories.sort().forEach((cat, index) => {
            console.log(`${index + 1}. ${cat}`);
        });
        console.log(`\nTotal categories: ${categories.length}`);

        // Also check counts per category
        const categoryCounts = await Inventory.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\nCategory distribution:');
        console.log('='.repeat(40));
        categoryCounts.forEach(cat => {
            console.log(`${cat._id}: ${cat.count} items`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

checkCategories();
