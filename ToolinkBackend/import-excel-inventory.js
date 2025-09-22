#!/usr/bin/env node

/**
 * Excel Inventory Data Importer
 * Imports detailed inventory data from 1234.xlsx into the database
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

const importInventoryData = async () => {
    console.log('📦 Excel Inventory Data Import');
    console.log('═'.repeat(50));

    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Read Excel file
        const excelPath = join(__dirname, '..', '1234.xlsx');
        const workbook = XLSX.readFile(excelPath);
        const worksheet = workbook.Sheets['All_Inventory'];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`📊 Found ${data.length} items in Excel file`);

        // Clear existing inventory (optional - comment out if you want to keep existing data)
        console.log('🗑️  Clearing existing inventory...');
        await mongoose.connection.db.collection('inventories').deleteMany({});

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

                const item = {
                    name: row.name || `Item ${index + 1}`,
                    description: row.description || '',
                    category: detailedCategory,
                    warehouse: row.warehouse || 'main_warehouse',
                    sku: row.sku || `SKU-${Date.now()}-${index}`,
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
                    specifications: row.specifications || '{}',
                    tags: [detailedCategory.toLowerCase(), originalCategory.toLowerCase()],
                    created_by: new mongoose.Types.ObjectId(), // Dummy ObjectId
                    notes: `Imported from Excel - Original Category: ${originalCategory}`
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

        // Import in batches
        const batchSize = 50;
        let imported = 0;

        for (let i = 0; i < inventoryItems.length; i += batchSize) {
            const batch = inventoryItems.slice(i, i + batchSize);

            try {
                await mongoose.connection.db.collection('inventories').insertMany(batch);
                imported += batch.length;
                console.log(`✅ Imported batch ${Math.floor(i / batchSize) + 1}: ${batch.length} items (Total: ${imported})`);
            } catch (error) {
                console.error(`❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error.message);
            }
        }

        // Summary
        console.log('\n🎉 Import Complete!');
        console.log('═'.repeat(50));
        console.log(`✅ Total items imported: ${imported}`);
        console.log(`📊 Items per warehouse:`);

        const warehouseCounts = {};
        inventoryItems.forEach(item => {
            warehouseCounts[item.warehouse] = (warehouseCounts[item.warehouse] || 0) + 1;
        });

        Object.entries(warehouseCounts).forEach(([warehouse, count]) => {
            console.log(`   • ${warehouse}: ${count} items`);
        });

        console.log(`\n📦 Categories created:`);
        const categories = [...new Set(inventoryItems.map(item => item.category))];
        categories.sort().forEach(category => {
            console.log(`   • ${category}`);
        });

    } catch (error) {
        console.error('❌ Import failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

importInventoryData();
