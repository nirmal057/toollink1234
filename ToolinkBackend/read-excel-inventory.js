#!/usr/bin/env node

/**
 * Excel Inventory Data Reader
 * Reads inventory data from 1234.xlsx file
 */

import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readExcelData = () => {
    console.log('📊 Reading Excel Inventory Data');
    console.log('═'.repeat(50));

    try {
        // Read the Excel file
        const excelPath = join(__dirname, '..', '1234.xlsx');
        const workbook = XLSX.readFile(excelPath);

        console.log('📁 Found sheets:', workbook.SheetNames);

        // Process each sheet
        workbook.SheetNames.forEach((sheetName, index) => {
            console.log(`\n📋 Sheet ${index + 1}: ${sheetName}`);
            console.log('─'.repeat(40));

            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            console.log(`Rows: ${data.length}`);

            if (data.length > 0) {
                console.log('Columns:', Object.keys(data[0]));
                console.log('\nFirst few rows:');
                data.slice(0, 5).forEach((row, i) => {
                    console.log(`Row ${i + 1}:`, row);
                });

                // Analyze warehouse and category structure
                if (data.length > 0) {
                    console.log('\n🏭 Warehouse Analysis:');
                    const warehouses = [...new Set(data.map(row =>
                        row.Warehouse || row.warehouse || row.WAREHOUSE ||
                        row.Location || row.location || row.LOCATION ||
                        'Unknown'
                    ).filter(w => w && w !== 'Unknown'))];
                    console.log('Warehouses found:', warehouses);

                    console.log('\n📦 Category Analysis:');
                    const categories = [...new Set(data.map(row =>
                        row.Category || row.category || row.CATEGORY ||
                        row.Type || row.type || row.TYPE ||
                        'Unknown'
                    ).filter(c => c && c !== 'Unknown'))];
                    console.log('Categories found:', categories);

                    // Warehouse-Category mapping
                    console.log('\n🔗 Warehouse-Category Mapping:');
                    const warehouseCategories = {};

                    data.forEach(row => {
                        const warehouse = row.Warehouse || row.warehouse || row.WAREHOUSE ||
                            row.Location || row.location || row.LOCATION;
                        const category = row.Category || row.category || row.CATEGORY ||
                            row.Type || row.type || row.TYPE;

                        if (warehouse && category) {
                            if (!warehouseCategories[warehouse]) {
                                warehouseCategories[warehouse] = new Set();
                            }
                            warehouseCategories[warehouse].add(category);
                        }
                    });

                    Object.entries(warehouseCategories).forEach(([warehouse, categories]) => {
                        console.log(`${warehouse}:`, Array.from(categories));
                    });
                }

                if (data.length > 10) {
                    console.log(`\n... and ${data.length - 5} more rows`);
                }
            }
        });

    } catch (error) {
        console.error('❌ Error reading Excel file:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure 1234.xlsx exists in the root directory');
        console.log('2. Check if the file is not open in Excel');
        console.log('3. Verify file permissions');
    }
};

readExcelData();
