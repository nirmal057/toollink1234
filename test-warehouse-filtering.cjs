const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017/ToolLink';

async function testWarehouseFiltering() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('ToolLink');
        const inventoryCollection = db.collection('inventories');
        
        // Test warehouse filtering for each warehouse
        const warehouses = [
            { name: 'warehouse1', description: 'Warehouse 1 (River Sand & Soil)' },
            { name: 'warehouse2', description: 'Warehouse 2 (Bricks & Masonry)' },
            { name: 'warehouse3', description: 'Warehouse 3 (Metals & Steel)' },
            { name: 'main_warehouse', description: 'Main Warehouse (Tools & Equipment)' }
        ];
        
        console.log('\n=== WAREHOUSE INVENTORY FILTERING TEST ===\n');
        
        for (const warehouse of warehouses) {
            console.log(`📦 ${warehouse.description}`);
            console.log('─'.repeat(50));
            
            // Get items for this warehouse
            const items = await inventoryCollection.find({ warehouse: warehouse.name }).toArray();
            
            console.log(`Total Items: ${items.length}`);
            
            if (items.length > 0) {
                // Group by category
                const categoryGroups = {};
                items.forEach(item => {
                    if (!categoryGroups[item.category]) {
                        categoryGroups[item.category] = [];
                    }
                    categoryGroups[item.category].push(item);
                });
                
                console.log('Categories:');
                Object.keys(categoryGroups).forEach(category => {
                    console.log(`  • ${category}: ${categoryGroups[category].length} items`);
                });
                
                console.log('Sample Items:');
                items.slice(0, 3).forEach(item => {
                    console.log(`  - ${item.name} (${item.category}) - Qty: ${item.quantity} ${item.unit}`);
                });
                
                if (items.length > 3) {
                    console.log(`  ... and ${items.length - 3} more items`);
                }
            } else {
                console.log('No items found for this warehouse');
            }
            
            console.log('');
        }
        
        // Test admin view (all warehouses)
        console.log('👑 Admin View (All Warehouses)');
        console.log('─'.repeat(50));
        
        const allItems = await inventoryCollection.find({}).toArray();
        console.log(`Total Items: ${allItems.length}`);
        
        // Group by warehouse
        const warehouseGroups = {};
        allItems.forEach(item => {
            if (!warehouseGroups[item.warehouse]) {
                warehouseGroups[item.warehouse] = [];
            }
            warehouseGroups[item.warehouse].push(item);
        });
        
        console.log('Distribution by Warehouse:');
        Object.keys(warehouseGroups).forEach(warehouse => {
            const warehouseInfo = warehouses.find(w => w.name === warehouse);
            const displayName = warehouseInfo ? warehouseInfo.description : warehouse;
            console.log(`  • ${displayName}: ${warehouseGroups[warehouse].length} items`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Run the test
testWarehouseFiltering().catch(console.error);