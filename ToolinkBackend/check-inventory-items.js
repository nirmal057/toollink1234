import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';

async function checkInventory() {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('Connected to database');

        const totalItems = await Inventory.countDocuments();
        console.log(`Total items in database: ${totalItems}`);

        if (totalItems > 0) {
            const sampleItems = await Inventory.find().limit(5);
            console.log('\nSample items:');
            sampleItems.forEach(item => {
                console.log(`- ${item.name} (${item.category}) - ${item.warehouse}`);
            });

            const categories = await Inventory.distinct('category');
            console.log('\nCategories:');
            categories.sort().forEach((cat, index) => {
                console.log(`${index + 1}. ${cat}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

checkInventory();
