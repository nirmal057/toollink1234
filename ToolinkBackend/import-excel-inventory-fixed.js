#!/usr/bin/env node

/**
 * Fixed Excel Inventory Data Importer
 * Handles duplicate SKUs properly
 */

import XLSX from 'xlsx';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink';

// Category mapping from Excel to new detailed categories
const categoryMapping = {
    'Sand & Aggregate': {
        'Fine': 'Fine Sand',
        'Medium': 'Medium Sand',
        'Coarse': 'Coarse Sand',
        'Washed': 'Washed Sand',
        'Aggregate': 'Aggregate',
        'default': 'River Sand'
    },
    'Bricks, Masonry & Stones': {
        '6"': '6 Inch Blocks',
        '4"': '4 Inch Blocks',
        '8"': '8 Inch Blocks',
        'Hollow': 'Hollow Cement Blocks',
        'Brick': 'Clay Bricks',
        'Block': 'Solid Cement Blocks',
        'Granite': 'Granite Slabs',
        'Paver': 'Interlocking Pavers',
        'default': 'Solid Cement Blocks'
    },
    'Steel & Reinforcement': {
        '6mm': '6mm Steel Rods',
        '8mm': '8mm Steel Rods',
        '10mm': '10mm Steel Rods',
        '12mm': '12mm Steel Rods',
        '16mm': '16mm Steel Rods',
        '20mm': '20mm Steel Rods',
        'Wire': 'Steel Wire',
        'Mesh': 'Wire Mesh',
        'Angle': 'Angle Iron',
        'default': '12mm Steel Rods'
    },
    'Tools, Equipment & Misc': {
        'Drill': 'Power Drills',
        'Grinder': 'Angle Grinders',
        'Hammer': 'Rotary Hammers',
        'Measuring': 'Measuring Tools',
        'Safety': 'Safety Equipment',
        'default': 'Hand Tools'
    }
};

function mapToDetailedCategory(originalCategory, itemName, itemSpecs) {
    const mapping = categoryMapping[originalCategory];
    if (!mapping) return originalCategory;

    // Check item name for keywords
    for (const [keyword, category] of Object.entries(mapping)) {
        if (keyword !== 'default' && itemName.toLowerCase().includes(keyword.toLowerCase())) {
            return category;
        }
    }

    // Check specifications
    if (itemSpecs) {
        try {
            const specs = JSON.parse(itemSpecs);
            for (const [keyword, category] of Object.entries(mapping)) {
                if (keyword !== 'default') {
                    const specValues = Object.values(specs).join(' ').toLowerCase();
                    if (specValues.includes(keyword.toLowerCase())) {
                        return category;
                    }
                }
            }
        } catch (e) {
            // Ignore JSON parse errors
        }
    }

    return mapping.default;
}

const importInventoryDataFixed = async () => {
    console.log('📦 Fixed Excel Inventory Data Import');
    console.log('═'.repeat(50));

    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Clear existing inventory first
        console.log('🗑️  Clearing existing inventory...');
        await mongoose.connection.db.collection('inventories').deleteMany({});
        console.log('✅ Cleared existing inventory');

        // Read Excel file
        const excelPath = join(__dirname, '..', '1234.xlsx');
        const workbook = XLSX.readFile(excelPath);
        const worksheet = workbook.Sheets['All_Inventory'];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`📊 Found ${data.length} items in Excel file`);

        // Track used SKUs to make them unique
        const usedSkus = new Set();

        // Prepare inventory items for import
        const inventoryItems = [];
        let skipped = 0;

        data.forEach((row, index) => {
            try {
                const originalCategory = row.Category;
                const detailedCategory = mapToDetailedCategory(
                    originalCategory,
                    row.name,
                    row.specifications
                );

                // Generate unique SKU
                let baseSku = row.sku || `SKU-${index + 1}`;
                let uniqueSku = baseSku;
                let counter = 1;

                while (usedSkus.has(uniqueSku)) {
                    uniqueSku = `${baseSku}-${counter}`;
                    counter++;
                }
                usedSkus.add(uniqueSku);

                const item = {
                    name: row.name || `Item ${index + 1}`,
                    description: row.description || '',
                    category: detailedCategory,
                    warehouse: row.warehouse || 'main_warehouse',
                    sku: uniqueSku,
                    quantity: parseInt(row.quantity) || 0,
                    current_stock: parseInt(row.current_stock) || parseInt(row.quantity) || 0,
                    unit: row.unit || 'pieces',
                    threshold: parseInt(row.threshold) || 10,
                    min_stock_level: parseInt(row.threshold) || 10,
                    max_stock_level: Math.max((parseInt(row.quantity) || 0) * 2, 1000),
                    location: row.location || 'Main Shop',
                    supplier_info: {
                        name: row.supplier || 'Unknown Supplier',
                        contact: '',
                        email: '',
                        phone: '',
                        address: ''
                    },
                    status: row.status || 'active',
                    low_stock_alert: true,
                    tags: [detailedCategory.toLowerCase(), originalCategory.toLowerCase()],
                    created_by: new mongoose.Types.ObjectId(), // Dummy ObjectId
                    notes: `Imported from Excel - Original Category: ${originalCategory}`,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                inventoryItems.push(item);
            } catch (error) {
                console.warn(`⚠️  Skipping row ${index + 1}: ${error.message}`);
                skipped++;
            }
        });

        console.log(`📝 Prepared ${inventoryItems.length} items for import`);
        if (skipped > 0) {
            console.log(`⚠️  Skipped ${skipped} invalid rows`);
        }

        // Import all items at once
        try {
            const result = await mongoose.connection.db.collection('inventories').insertMany(inventoryItems);
            console.log(`✅ Successfully imported ${result.insertedCount} items`);
        } catch (error) {
            console.error(`❌ Error importing items:`, error.message);
        }

        // Summary
        console.log('\n🎉 Import Complete!');
        console.log('═'.repeat(50));

        const warehouseCounts = {};
        inventoryItems.forEach(item => {
            warehouseCounts[item.warehouse] = (warehouseCounts[item.warehouse] || 0) + 1;
        });

        console.log(`📊 Items per warehouse:`);
        Object.entries(warehouseCounts).forEach(([warehouse, count]) => {
            console.log(`   • ${warehouse}: ${count} items`);
        });

        console.log(`\n📦 Categories created:`);
        const categories = [...new Set(inventoryItems.map(item => item.category))];
        categories.sort().forEach(category => {
            console.log(`   • ${category}`);
        });

        console.log('\n✅ Your ToolLink system now has detailed warehouse-specific categories!');

    } catch (error) {
        console.error('❌ Import failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

importInventoryDataFixed();
