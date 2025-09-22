// Test script to verify chart grouping
const categoryDistribution = [
    { _id: 'Fine Sand', count: 6 },
    { _id: 'Medium Sand', count: 6 },
    { _id: 'Coarse Sand', count: 6 },
    { _id: '10mm Steel Rods', count: 6 },
    { _id: '12mm Steel Rods', count: 6 },
    { _id: '4 Inch Blocks', count: 6 },
    { _id: '6 Inch Blocks', count: 6 },
    { _id: 'Power Drills', count: 6 },
    { _id: 'Hand Tools', count: 6 }
];

// Simulate the grouping function
const warehouseGroups = {
    '🏠 Warehouse 1 (River Sand) - Sand & Aggregate': 0,
    '🧱 Warehouse 2 (Bricks) - Bricks, Masonry, Stones': 0,
    '⚙️ Warehouse 3 (Metals) - Steel & Reinforcement': 0,
    '🔧 Main Warehouse (Tools) - Tools, Equipment & Misc': 0
};

const categoryToWarehouse = {
    'Fine Sand': '🏠 Warehouse 1 (River Sand) - Sand & Aggregate',
    'Medium Sand': '🏠 Warehouse 1 (River Sand) - Sand & Aggregate',
    'Coarse Sand': '🏠 Warehouse 1 (River Sand) - Sand & Aggregate',
    '10mm Steel Rods': '⚙️ Warehouse 3 (Metals) - Steel & Reinforcement',
    '12mm Steel Rods': '⚙️ Warehouse 3 (Metals) - Steel & Reinforcement',
    '4 Inch Blocks': '🧱 Warehouse 2 (Bricks) - Bricks, Masonry, Stones',
    '6 Inch Blocks': '🧱 Warehouse 2 (Bricks) - Bricks, Masonry, Stones',
    'Power Drills': '🔧 Main Warehouse (Tools) - Tools, Equipment & Misc',
    'Hand Tools': '🔧 Main Warehouse (Tools) - Tools, Equipment & Misc'
};

categoryDistribution.forEach(item => {
    const warehouseGroup = categoryToWarehouse[item._id];
    if (warehouseGroup) {
        warehouseGroups[warehouseGroup] += item.count;
    }
});

console.log('Expected Admin Chart Result:');
Object.entries(warehouseGroups).forEach(([warehouse, count]) => {
    console.log(`${warehouse}: ${count} items`);
});

// Should output:
// 🏠 Warehouse 1 (River Sand) - Sand & Aggregate: 18 items
// 🧱 Warehouse 2 (Bricks) - Bricks, Masonry, Stones: 12 items
// ⚙️ Warehouse 3 (Metals) - Steel & Reinforcement: 12 items
// 🔧 Main Warehouse (Tools) - Tools, Equipment & Misc: 12 items
