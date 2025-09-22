#!/usr/bin/env node

/**
 * Detailed Category Analysis
 * Analyzes Excel data to create detailed subcategory mappings
 */

import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const analyzeDetailedCategories = () => {
    console.log('🔍 Detailed Category Analysis');
    console.log('═'.repeat(60));

    try {
        const excelPath = join(__dirname, '..', '1234.xlsx');
        const workbook = XLSX.readFile(excelPath);

        // Read all inventory data
        const worksheet = workbook.Sheets['All_Inventory'];
        const data = XLSX.utils.sheet_to_json(worksheet);

        // Group by warehouse and analyze item types
        const warehouseAnalysis = {};

        data.forEach(item => {
            const warehouse = item.warehouse || item.Warehouse;
            const name = item.name;
            const specs = item.specifications ? JSON.parse(item.specifications) : {};

            if (!warehouseAnalysis[warehouse]) {
                warehouseAnalysis[warehouse] = {
                    items: [],
                    subcategories: new Set()
                };
            }

            warehouseAnalysis[warehouse].items.push({
                name: name,
                specs: specs,
                sku: item.sku,
                description: item.description
            });
        });

        // Analyze subcategories for each warehouse
        console.log('\n📊 Warehouse Subcategory Analysis:');
        console.log('═'.repeat(60));

        Object.entries(warehouseAnalysis).forEach(([warehouse, data]) => {
            console.log(`\n🏭 ${warehouse.toUpperCase()}`);
            console.log('─'.repeat(40));

            const subcategories = new Set();
            const itemTypes = new Set();

            data.items.forEach(item => {
                // Extract subcategories from item names and specs
                if (warehouse === 'warehouse1') {
                    // Sand & Aggregate subcategories
                    if (item.name.includes('Fine')) subcategories.add('Fine Sand');
                    if (item.name.includes('Medium')) subcategories.add('Medium Sand');
                    if (item.name.includes('Coarse')) subcategories.add('Coarse Sand');
                    if (item.name.includes('River')) subcategories.add('River Sand');
                    if (item.name.includes('Sea')) subcategories.add('Sea Sand');
                    if (item.name.includes('Aggregate')) subcategories.add('Aggregate');
                    if (item.name.includes('Gravel')) subcategories.add('Gravel');
                    if (item.name.includes('Stone')) subcategories.add('Stone Chips');
                    if (item.specs.type) subcategories.add(`${item.specs.type} Sand`);
                }
                else if (warehouse === 'warehouse2') {
                    // Bricks & Masonry subcategories
                    if (item.name.includes('Block')) subcategories.add('Cement Blocks');
                    if (item.name.includes('Brick')) subcategories.add('Bricks');
                    if (item.name.includes('Hollow')) subcategories.add('Hollow Blocks');
                    if (item.name.includes('6"')) subcategories.add('6 Inch Blocks');
                    if (item.name.includes('4"')) subcategories.add('4 Inch Blocks');
                    if (item.name.includes('8"')) subcategories.add('8 Inch Blocks');
                    if (item.name.includes('Stone')) subcategories.add('Stones');
                    if (item.specs.size) subcategories.add(`${item.specs.size} Blocks`);
                }
                else if (warehouse === 'warehouse3') {
                    // Steel & Reinforcement subcategories
                    if (item.name.includes('10mm')) subcategories.add('10mm Steel Rods');
                    if (item.name.includes('12mm')) subcategories.add('12mm Steel Rods');
                    if (item.name.includes('16mm')) subcategories.add('16mm Steel Rods');
                    if (item.name.includes('20mm')) subcategories.add('20mm Steel Rods');
                    if (item.name.includes('Wire')) subcategories.add('Steel Wire');
                    if (item.name.includes('Mesh')) subcategories.add('Wire Mesh');
                    if (item.name.includes('Angle')) subcategories.add('Angle Iron');
                    if (item.specs.diameter) subcategories.add(`${item.specs.diameter} Steel Rods`);
                }
                else if (warehouse === 'main_warehouse') {
                    // Tools & Equipment subcategories
                    if (item.name.includes('Drill')) subcategories.add('Power Drills');
                    if (item.name.includes('Grinder')) subcategories.add('Angle Grinders');
                    if (item.name.includes('Hammer')) subcategories.add('Hammers');
                    if (item.name.includes('Saw')) subcategories.add('Saws');
                    if (item.name.includes('Wrench')) subcategories.add('Wrenches');
                    if (item.name.includes('Screw')) subcategories.add('Screwdrivers');
                    if (item.name.includes('Safety')) subcategories.add('Safety Equipment');
                    if (item.specs.brand) subcategories.add(`${item.specs.brand} Tools`);
                }

                itemTypes.add(item.name);
            });

            console.log(`📦 Items: ${data.items.length}`);
            console.log(`🏷️  Subcategories Found: ${subcategories.size}`);
            console.log('Subcategories:');
            Array.from(subcategories).sort().forEach(sub => {
                console.log(`   • ${sub}`);
            });

            console.log('\n📋 Sample Items:');
            Array.from(itemTypes).slice(0, 5).forEach(item => {
                console.log(`   • ${item}`);
            });
            if (itemTypes.size > 5) {
                console.log(`   ... and ${itemTypes.size - 5} more items`);
            }
        });

        // Generate updated category mapping
        console.log('\n\n🔧 Updated Category Mapping for Code:');
        console.log('═'.repeat(60));

        const updatedMapping = {
            'warehouse1': [
                'Fine Sand', 'Medium Sand', 'Coarse Sand',
                'River Sand', 'Sea Sand', 'Stone Chips',
                'Gravel', 'Aggregate'
            ],
            'warehouse2': [
                'Solid Cement Blocks', 'Hollow Cement Blocks',
                'Clay Bricks', '4 Inch Blocks', '6 Inch Blocks',
                '8 Inch Blocks', 'Paving Stones', 'Decorative Stones'
            ],
            'warehouse3': [
                '10mm Steel Rods', '12mm Steel Rods', '16mm Steel Rods',
                '20mm Steel Rods', 'Steel Wire', 'Wire Mesh',
                'Angle Iron', 'Steel Plates'
            ],
            'main_warehouse': [
                'Power Drills', 'Angle Grinders', 'Hand Tools',
                'Measuring Tools', 'Safety Equipment', 'Hardware',
                'Electrical Tools', 'Cutting Tools'
            ]
        };

        console.log('const getWarehouseCategories = (warehouse: string): string[] => {');
        console.log('    const warehouseCategories: { [key: string]: string[] } = {');
        Object.entries(updatedMapping).forEach(([warehouse, categories]) => {
            console.log(`        '${warehouse}': [`);
            categories.forEach((cat, index) => {
                const comma = index < categories.length - 1 ? ',' : '';
                console.log(`            '${cat}'${comma}`);
            });
            console.log('        ],');
        });
        console.log('    };');
        console.log('    return warehouseCategories[warehouse] || [];');
        console.log('};');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

analyzeDetailedCategories();
