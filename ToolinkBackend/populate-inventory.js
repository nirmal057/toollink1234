import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';

// MongoDB connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb+srv://nirmal123:nirmal123@cluster0.2khsj.mongodb.net/toollink?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

// Sample inventory data for each category
const inventoryData = [
    // Cement Category
    {
        name: 'Tokyo Cement OPC',
        description: 'High quality Ordinary Portland Cement suitable for all construction works',
        category: 'Cement',
        sku: 'CEM-TOK-OPC-50',
        quantity: 500,
        current_stock: 500,
        unit: 'kg',
        threshold: 50,
        cost_price: 850,
        selling_price: 950,
        supplier: 'Tokyo Cement Lanka',
        location: 'Main Warehouse - Section A',
        warehouse_id: 'WH001',
        expiry_date: null,
        batch_number: 'TC2025001'
    },
    {
        name: 'Lafarge Cement',
        description: 'Premium cement for heavy construction projects',
        category: 'Cement',
        sku: 'CEM-LAF-PRM-50',
        quantity: 300,
        current_stock: 300,
        unit: 'kg',
        threshold: 30,
        cost_price: 900,
        selling_price: 1000,
        supplier: 'Lafarge Cement',
        location: 'Main Warehouse - Section A',
        warehouse_id: 'WH001',
        expiry_date: null,
        batch_number: 'LF2025001'
    },

    // Steel & Reinforcement
    {
        name: 'Steel Bars 12mm',
        description: 'High tensile strength steel reinforcement bars',
        category: 'Steel & Reinforcement',
        sku: 'STL-BAR-12MM',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        cost_price: 1200,
        selling_price: 1350,
        supplier: 'Lanka Steel Corporation',
        location: 'Steel Yard - Section B',
        warehouse_id: 'WH002',
        expiry_date: null,
        batch_number: 'LSC2025001'
    },
    {
        name: 'Steel Bars 16mm',
        description: 'Heavy duty steel reinforcement bars for large constructions',
        category: 'Steel & Reinforcement',
        sku: 'STL-BAR-16MM',
        quantity: 80,
        current_stock: 80,
        unit: 'pieces',
        threshold: 8,
        cost_price: 1800,
        selling_price: 2000,
        supplier: 'Lanka Steel Corporation',
        location: 'Steel Yard - Section B',
        warehouse_id: 'WH002',
        expiry_date: null,
        batch_number: 'LSC2025002'
    },
    {
        name: 'Steel Mesh 6mm',
        description: 'Welded steel mesh for concrete reinforcement',
        category: 'Steel & Reinforcement',
        sku: 'STL-MSH-6MM',
        quantity: 50,
        current_stock: 50,
        unit: 'sheets',
        threshold: 5,
        cost_price: 2500,
        selling_price: 2800,
        supplier: 'Ceylon Steel',
        location: 'Steel Yard - Section C',
        warehouse_id: 'WH002',
        expiry_date: null,
        batch_number: 'CS2025001'
    },

    // Paint & Chemicals
    {
        name: 'Dulux Weatherguard Paint',
        description: 'Exterior wall paint with weather protection',
        category: 'Paint & Chemicals',
        sku: 'PNT-DUL-WG-4L',
        quantity: 200,
        current_stock: 200,
        unit: 'liters',
        threshold: 20,
        cost_price: 3500,
        selling_price: 4000,
        supplier: 'Dulux Lanka',
        location: 'Paint Storage - Section D',
        warehouse_id: 'WH003',
        expiry_date: new Date('2026-12-31'),
        batch_number: 'DUL2025001'
    },
    {
        name: 'Nippon Paint Interior',
        description: 'Premium interior wall paint with low VOC',
        category: 'Paint & Chemicals',
        sku: 'PNT-NIP-INT-4L',
        quantity: 150,
        current_stock: 150,
        unit: 'liters',
        threshold: 15,
        cost_price: 2800,
        selling_price: 3200,
        supplier: 'Nippon Paint Lanka',
        location: 'Paint Storage - Section D',
        warehouse_id: 'WH003',
        expiry_date: new Date('2026-10-31'),
        batch_number: 'NIP2025001'
    },
    {
        name: 'Thinner Solvent',
        description: 'Paint thinner for oil-based paints',
        category: 'Paint & Chemicals',
        sku: 'CHM-THN-SOL-1L',
        quantity: 100,
        current_stock: 100,
        unit: 'liters',
        threshold: 10,
        cost_price: 450,
        selling_price: 550,
        supplier: 'Chemical Industries',
        location: 'Chemical Storage - Section E',
        warehouse_id: 'WH003',
        expiry_date: new Date('2027-06-30'),
        batch_number: 'CI2025001'
    },

    // Electrical Items
    {
        name: 'Copper Wire 2.5mm',
        description: 'High quality copper electrical wire',
        category: 'Electrical Items',
        sku: 'ELC-COP-25MM-100M',
        quantity: 50,
        current_stock: 50,
        unit: 'rolls',
        threshold: 5,
        cost_price: 8500,
        selling_price: 9500,
        supplier: 'Ceylon Electricity Board',
        location: 'Electrical Storage - Section F',
        warehouse_id: 'WH004',
        expiry_date: null,
        batch_number: 'CEB2025001'
    },
    {
        name: 'LED Bulb 12W',
        description: 'Energy efficient LED light bulbs',
        category: 'Electrical Items',
        sku: 'ELC-LED-12W',
        quantity: 200,
        current_stock: 200,
        unit: 'pieces',
        threshold: 20,
        cost_price: 350,
        selling_price: 450,
        supplier: 'Lighting Solutions',
        location: 'Electrical Storage - Section F',
        warehouse_id: 'WH004',
        expiry_date: null,
        batch_number: 'LS2025001'
    },
    {
        name: 'Circuit Breaker 32A',
        description: 'Single pole circuit breaker 32 Amp',
        category: 'Electrical Items',
        sku: 'ELC-CB-32A',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        cost_price: 1200,
        selling_price: 1400,
        supplier: 'ABB Lanka',
        location: 'Electrical Storage - Section G',
        warehouse_id: 'WH004',
        expiry_date: null,
        batch_number: 'ABB2025001'
    },

    // Plumbing Supplies
    {
        name: 'PVC Pipe 4 inch',
        description: 'High grade PVC drainage pipe',
        category: 'Plumbing Supplies',
        sku: 'PLB-PVC-4IN-6M',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        cost_price: 800,
        selling_price: 950,
        supplier: 'Plastics Lanka',
        location: 'Plumbing Storage - Section H',
        warehouse_id: 'WH005',
        expiry_date: null,
        batch_number: 'PL2025001'
    },
    {
        name: 'Water Tap Brass',
        description: 'Heavy duty brass water tap',
        category: 'Plumbing Supplies',
        sku: 'PLB-TAP-BRS',
        quantity: 80,
        current_stock: 80,
        unit: 'pieces',
        threshold: 8,
        cost_price: 1500,
        selling_price: 1800,
        supplier: 'Plumbing Solutions',
        location: 'Plumbing Storage - Section H',
        warehouse_id: 'WH005',
        expiry_date: null,
        batch_number: 'PS2025001'
    },
    {
        name: 'Toilet Seat Standard',
        description: 'Standard white toilet seat with fittings',
        category: 'Plumbing Supplies',
        sku: 'PLB-TS-STD-WHT',
        quantity: 50,
        current_stock: 50,
        unit: 'pieces',
        threshold: 5,
        cost_price: 2500,
        selling_price: 3000,
        supplier: 'Sanitary Ware Lanka',
        location: 'Plumbing Storage - Section I',
        warehouse_id: 'WH005',
        expiry_date: null,
        batch_number: 'SWL2025001'
    },

    // Tools & Equipment
    {
        name: 'Hammer 500g',
        description: 'Heavy duty construction hammer',
        category: 'Tools & Equipment',
        sku: 'TOL-HAM-500G',
        quantity: 60,
        current_stock: 60,
        unit: 'pieces',
        threshold: 6,
        cost_price: 800,
        selling_price: 1000,
        supplier: 'Tools Lanka',
        location: 'Tools Storage - Section J',
        warehouse_id: 'WH006',
        expiry_date: null,
        batch_number: 'TL2025001'
    },
    {
        name: 'Electric Drill 13mm',
        description: 'Professional electric drill with variable speed',
        category: 'Tools & Equipment',
        sku: 'TOL-DRL-13MM-ELC',
        quantity: 20,
        current_stock: 20,
        unit: 'pieces',
        threshold: 2,
        cost_price: 8500,
        selling_price: 10000,
        supplier: 'Power Tools Lanka',
        location: 'Tools Storage - Section K',
        warehouse_id: 'WH006',
        expiry_date: null,
        batch_number: 'PTL2025001'
    },
    {
        name: 'Measuring Tape 5m',
        description: 'Steel measuring tape with lock mechanism',
        category: 'Tools & Equipment',
        sku: 'TOL-MT-5M',
        quantity: 40,
        current_stock: 40,
        unit: 'pieces',
        threshold: 4,
        cost_price: 450,
        selling_price: 600,
        supplier: 'Measuring Tools Co',
        location: 'Tools Storage - Section J',
        warehouse_id: 'WH006',
        expiry_date: null,
        batch_number: 'MTC2025001'
    },

    // Hardware & Fasteners
    {
        name: 'Screws 2 inch',
        description: 'Galvanized wood screws',
        category: 'Hardware & Fasteners',
        sku: 'HWR-SCR-2IN-100',
        quantity: 500,
        current_stock: 500,
        unit: 'pieces',
        threshold: 50,
        cost_price: 5,
        selling_price: 8,
        supplier: 'Hardware Solutions',
        location: 'Hardware Storage - Section L',
        warehouse_id: 'WH007',
        expiry_date: null,
        batch_number: 'HS2025001'
    },
    {
        name: 'Nuts & Bolts Set M8',
        description: 'Complete set of M8 nuts and bolts',
        category: 'Hardware & Fasteners',
        sku: 'HWR-NB-M8-SET',
        quantity: 200,
        current_stock: 200,
        unit: 'sets',
        threshold: 20,
        cost_price: 150,
        selling_price: 200,
        supplier: 'Fasteners Lanka',
        location: 'Hardware Storage - Section L',
        warehouse_id: 'WH007',
        expiry_date: null,
        batch_number: 'FL2025001'
    },
    {
        name: 'Hinges Steel 4 inch',
        description: 'Heavy duty steel door hinges',
        category: 'Hardware & Fasteners',
        sku: 'HWR-HNG-STL-4IN',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        cost_price: 300,
        selling_price: 400,
        supplier: 'Door Hardware Lanka',
        location: 'Hardware Storage - Section M',
        warehouse_id: 'WH007',
        expiry_date: null,
        batch_number: 'DHL2025001'
    },

    // Tiles & Ceramics
    {
        name: 'Floor Tiles 12x12',
        description: 'Premium ceramic floor tiles',
        category: 'Tiles & Ceramics',
        sku: 'TIL-FLR-12X12',
        quantity: 1000,
        current_stock: 1000,
        unit: 'pieces',
        threshold: 100,
        cost_price: 120,
        selling_price: 150,
        supplier: 'Lanka Tiles',
        location: 'Tiles Storage - Section N',
        warehouse_id: 'WH008',
        expiry_date: null,
        batch_number: 'LT2025001'
    },
    {
        name: 'Wall Tiles 8x12',
        description: 'Glossy ceramic wall tiles for bathrooms',
        category: 'Tiles & Ceramics',
        sku: 'TIL-WAL-8X12',
        quantity: 800,
        current_stock: 800,
        unit: 'pieces',
        threshold: 80,
        cost_price: 80,
        selling_price: 110,
        supplier: 'Ceramic Works',
        location: 'Tiles Storage - Section O',
        warehouse_id: 'WH008',
        expiry_date: null,
        batch_number: 'CW2025001'
    },

    // Roofing Materials
    {
        name: 'Roof Tiles Clay',
        description: 'Traditional clay roof tiles',
        category: 'Roofing Materials',
        sku: 'ROF-TIL-CLY',
        quantity: 2000,
        current_stock: 2000,
        unit: 'pieces',
        threshold: 200,
        cost_price: 45,
        selling_price: 60,
        supplier: 'Clay Tiles Lanka',
        location: 'Roofing Storage - Section P',
        warehouse_id: 'WH009',
        expiry_date: null,
        batch_number: 'CTL2025001'
    },
    {
        name: 'Aluminum Sheets',
        description: 'Corrugated aluminum roofing sheets',
        category: 'Roofing Materials',
        sku: 'ROF-ALM-COR-3M',
        quantity: 100,
        current_stock: 100,
        unit: 'sheets',
        threshold: 10,
        cost_price: 2500,
        selling_price: 3000,
        supplier: 'Aluminum Works',
        location: 'Roofing Storage - Section Q',
        warehouse_id: 'WH009',
        expiry_date: null,
        batch_number: 'AW2025001'
    },

    // Safety Equipment
    {
        name: 'Safety Helmet',
        description: 'High impact safety helmet with chin strap',
        category: 'Safety Equipment',
        sku: 'SAF-HLM-WHT',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        cost_price: 800,
        selling_price: 1000,
        supplier: 'Safety First Lanka',
        location: 'Safety Storage - Section R',
        warehouse_id: 'WH010',
        expiry_date: null,
        batch_number: 'SFL2025001'
    },
    {
        name: 'Safety Gloves',
        description: 'Heavy duty work gloves',
        category: 'Safety Equipment',
        sku: 'SAF-GLV-HVY',
        quantity: 200,
        current_stock: 200,
        unit: 'pairs',
        threshold: 20,
        cost_price: 250,
        selling_price: 350,
        supplier: 'Work Safety Co',
        location: 'Safety Storage - Section R',
        warehouse_id: 'WH010',
        expiry_date: null,
        batch_number: 'WSC2025001'
    },

    // Sand & Aggregate
    {
        name: 'River Sand Fine',
        description: 'Fine river sand for construction',
        category: 'Sand & Aggregate',
        sku: 'SND-RVR-FIN',
        quantity: 10000,
        current_stock: 10000,
        unit: 'kg',
        threshold: 1000,
        cost_price: 15,
        selling_price: 20,
        supplier: 'Sand Quarry Lanka',
        location: 'Sand Storage - Yard A',
        warehouse_id: 'WH011',
        expiry_date: null,
        batch_number: 'SQL2025001'
    },
    {
        name: 'Gravel 20mm',
        description: 'Crushed gravel for concrete mix',
        category: 'Sand & Aggregate',
        sku: 'GRV-CRS-20MM',
        quantity: 8000,
        current_stock: 8000,
        unit: 'kg',
        threshold: 800,
        cost_price: 25,
        selling_price: 32,
        supplier: 'Quarry Works',
        location: 'Gravel Storage - Yard B',
        warehouse_id: 'WH011',
        expiry_date: null,
        batch_number: 'QW2025001'
    },

    // Bricks
    {
        name: 'Red Bricks Standard',
        description: 'Standard red clay bricks',
        category: 'Bricks',
        sku: 'BRK-RED-STD',
        quantity: 5000,
        current_stock: 5000,
        unit: 'pieces',
        threshold: 500,
        cost_price: 12,
        selling_price: 18,
        supplier: 'Brick Factory Lanka',
        location: 'Brick Storage - Yard C',
        warehouse_id: 'WH012',
        expiry_date: null,
        batch_number: 'BFL2025001'
    },
    {
        name: 'Hollow Blocks',
        description: 'Concrete hollow blocks for walls',
        category: 'Masonry Blocks',
        sku: 'BRK-HLW-CON',
        quantity: 3000,
        current_stock: 3000,
        unit: 'pieces',
        threshold: 300,
        cost_price: 35,
        selling_price: 45,
        supplier: 'Concrete Products',
        location: 'Block Storage - Yard D',
        warehouse_id: 'WH012',
        expiry_date: null,
        batch_number: 'CP2025001'
    },

    // Stones
    {
        name: 'Black Stones Crushed',
        description: 'Crushed black stones for construction',
        category: 'Stones',
        sku: 'STN-BLK-CRS',
        quantity: 12000,
        current_stock: 12000,
        unit: 'kg',
        threshold: 1200,
        cost_price: 18,
        selling_price: 25,
        supplier: 'Stone Quarry Co',
        location: 'Stone Storage - Yard E',
        warehouse_id: 'WH013',
        expiry_date: null,
        batch_number: 'SQC2025001'
    },
    {
        name: 'White Stones Decorative',
        description: 'Decorative white stones for landscaping',
        category: 'Stones',
        sku: 'STN-WHT-DEC',
        quantity: 5000,
        current_stock: 5000,
        unit: 'kg',
        threshold: 500,
        cost_price: 30,
        selling_price: 40,
        supplier: 'Decorative Stones Lanka',
        location: 'Stone Storage - Yard F',
        warehouse_id: 'WH013',
        expiry_date: null,
        batch_number: 'DSL2025001'
    }
];

// Function to populate inventory
const populateInventory = async () => {
    try {
        await connectDB();

        // Clear existing inventory
        await Inventory.deleteMany({});
        console.log('Existing inventory cleared');

        // Insert new inventory data
        const result = await Inventory.insertMany(inventoryData);
        console.log(`Successfully inserted ${result.length} inventory items`);

        // Display summary by category
        const categories = [...new Set(inventoryData.map(item => item.category))];
        console.log('\n📦 Inventory Summary by Category:');
        console.log('=====================================');

        for (const category of categories) {
            const categoryItems = inventoryData.filter(item => item.category === category);
            console.log(`${category}: ${categoryItems.length} items`);
        }

        console.log('\n✅ Inventory population completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Error populating inventory:', error);
        process.exit(1);
    }
};

populateInventory();
