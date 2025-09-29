import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';
import User from './src/models/User.js';

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for inventory reset');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// New inventory items with proper warehouse codes and categories
const newInventoryItems = [
    // W1 - Sand & Aggregate Items
    {
        name: 'River Sand - Fine Grade',
        description: 'High quality fine river sand for plastering and finishing',
        category: 'Fine Sand',
        warehouse: 'W1',
        warehouseCode: 'W1',
        location: 'W1',
        quantity: 500,
        current_stock: 500,
        unit: 'cubic_ft',
        threshold: 50,
        min_stock_level: 50,
        max_stock_level: 1000,
        supplier_info: {
            name: 'River Sand Suppliers Ltd',
            contact: '0771234567'
        }
    },
    {
        name: 'Medium Sand for Construction',
        description: 'Medium grade sand for general construction work',
        category: 'Medium Sand',
        warehouse: 'W1',
        warehouseCode: 'W1',
        location: 'W1',
        quantity: 800,
        current_stock: 800,
        unit: 'cubic_ft',
        threshold: 100,
        min_stock_level: 100,
        max_stock_level: 1500,
        supplier_info: {
            name: 'Sand & Aggregate Co.',
            contact: '0771234568'
        }
    },
    {
        name: 'Coarse Sand',
        description: 'Coarse grade sand for concrete mixing',
        category: 'Coarse Sand',
        warehouse: 'W1',
        warehouseCode: 'W1',
        location: 'W1',
        quantity: 600,
        current_stock: 600,
        unit: 'cubic_ft',
        threshold: 75,
        min_stock_level: 75,
        max_stock_level: 1200,
        supplier_info: {
            name: 'Quality Sand Suppliers',
            contact: '0771234569'
        }
    },
    {
        name: '10mm Aggregate',
        description: '10mm crushed stone aggregate for concrete',
        category: 'Aggregate',
        warehouse: 'W1',
        warehouseCode: 'W1',
        location: 'W1',
        quantity: 400,
        current_stock: 400,
        unit: 'cubic_ft',
        threshold: 50,
        min_stock_level: 50,
        max_stock_level: 800,
        supplier_info: {
            name: 'Stone Crushers Ltd',
            contact: '0771234570'
        }
    },
    {
        name: '20mm Aggregate',
        description: '20mm crushed stone aggregate for concrete',
        category: 'Aggregate',
        warehouse: 'W1',
        warehouseCode: 'W1',
        location: 'W1',
        quantity: 350,
        current_stock: 350,
        unit: 'cubic_ft',
        threshold: 40,
        min_stock_level: 40,
        max_stock_level: 700,
        supplier_info: {
            name: 'Stone Crushers Ltd',
            contact: '0771234570'
        }
    },

    // W2 - Bricks & Masonry Items
    {
        name: 'Solid Cement Block 6"',
        description: '6 inch solid cement blocks for construction',
        category: '6 Inch Blocks',
        warehouse: 'W2',
        warehouseCode: 'W2',
        location: 'W2',
        quantity: 1000,
        current_stock: 1000,
        unit: 'pieces',
        threshold: 100,
        min_stock_level: 100,
        max_stock_level: 2000,
        supplier_info: {
            name: 'Ceylon Cement Works',
            contact: '0112345678'
        }
    },
    {
        name: 'Hollow Cement Block 6"',
        description: '6 inch hollow cement blocks',
        category: '6 Inch Blocks',
        warehouse: 'W2',
        warehouseCode: 'W2',
        location: 'W2',
        quantity: 800,
        current_stock: 800,
        unit: 'pieces',
        threshold: 80,
        min_stock_level: 80,
        max_stock_level: 1600,
        supplier_info: {
            name: 'Ceylon Cement Works',
            contact: '0112345678'
        }
    },
    {
        name: 'Solid Cement Block 4"',
        description: '4 inch solid cement blocks',
        category: '4 Inch Blocks',
        warehouse: 'W2',
        warehouseCode: 'W2',
        location: 'W2',
        quantity: 1200,
        current_stock: 1200,
        unit: 'pieces',
        threshold: 120,
        min_stock_level: 120,
        max_stock_level: 2400,
        supplier_info: {
            name: 'Block Manufacturers Ltd',
            contact: '0112345679'
        }
    },
    {
        name: 'Red Clay Brick - Standard',
        description: 'High quality red clay bricks',
        category: 'Clay Bricks',
        warehouse: 'W2',
        warehouseCode: 'W2',
        location: 'W2',
        quantity: 2000,
        current_stock: 2000,
        unit: 'pieces',
        threshold: 200,
        min_stock_level: 200,
        max_stock_level: 4000,
        supplier_info: {
            name: 'Clay Brick Industries',
            contact: '0771234571'
        }
    },
    {
        name: 'Interlocking Pavers - Grey',
        description: 'Grey concrete interlocking pavers',
        category: 'Interlocking Pavers',
        warehouse: 'W2',
        warehouseCode: 'W2',
        location: 'W2',
        quantity: 500,
        current_stock: 500,
        unit: 'pieces',
        threshold: 50,
        min_stock_level: 50,
        max_stock_level: 1000,
        supplier_info: {
            name: 'Paver Solutions',
            contact: '0771234572'
        }
    },

    // W3 - Steel & Metal Items
    {
        name: 'Steel Rod 10mm - High Grade',
        description: 'High tensile strength 10mm steel rods',
        category: '10mm Steel Rods',
        warehouse: 'W3',
        warehouseCode: 'W3',
        location: 'W3',
        quantity: 200,
        current_stock: 200,
        unit: 'pieces',
        threshold: 20,
        min_stock_level: 20,
        max_stock_level: 400,
        supplier_info: {
            name: 'Lanka Steel Corporation',
            contact: '0112345680'
        }
    },
    {
        name: 'Steel Rod 12mm - High Grade',
        description: 'High tensile strength 12mm steel rods',
        category: '12mm Steel Rods',
        warehouse: 'W3',
        warehouseCode: 'W3',
        location: 'W3',
        quantity: 180,
        current_stock: 180,
        unit: 'pieces',
        threshold: 18,
        min_stock_level: 18,
        max_stock_level: 360,
        supplier_info: {
            name: 'Lanka Steel Corporation',
            contact: '0112345680'
        }
    },
    {
        name: 'Steel Rod 16mm - High Grade',
        description: 'High tensile strength 16mm steel rods',
        category: '16mm Steel Rods',
        warehouse: 'W3',
        warehouseCode: 'W3',
        location: 'W3',
        quantity: 150,
        current_stock: 150,
        unit: 'pieces',
        threshold: 15,
        min_stock_level: 15,
        max_stock_level: 300,
        supplier_info: {
            name: 'Steel Masters Ltd',
            contact: '0771234573'
        }
    },
    {
        name: 'Binding Wire 16 Gauge',
        description: 'Galvanized binding wire for construction',
        category: 'Steel Wire',
        warehouse: 'W3',
        warehouseCode: 'W3',
        location: 'W3',
        quantity: 100,
        current_stock: 100,
        unit: 'kg',
        threshold: 10,
        min_stock_level: 10,
        max_stock_level: 200,
        supplier_info: {
            name: 'Wire Solutions Lanka',
            contact: '0771234574'
        }
    },
    {
        name: 'Steel Mesh 6mm - BRC',
        description: 'BRC steel reinforcement mesh',
        category: 'Steel Mesh',
        warehouse: 'W3',
        warehouseCode: 'W3',
        location: 'W3',
        quantity: 50,
        current_stock: 50,
        unit: 'sheets',
        threshold: 5,
        min_stock_level: 5,
        max_stock_level: 100,
        supplier_info: {
            name: 'Mesh Manufacturers',
            contact: '0771234575'
        }
    },

    // WM - Tools & Equipment Items
    {
        name: 'Makita Electric Drill 750W',
        description: 'Professional electric drill with variable speed',
        category: 'Power Drills',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 15,
        current_stock: 15,
        unit: 'pieces',
        threshold: 2,
        min_stock_level: 2,
        max_stock_level: 30,
        supplier_info: {
            name: 'Tool Center Lanka',
            contact: '0112345681'
        }
    },
    {
        name: 'Bosch Angle Grinder 900W',
        description: '4.5 inch professional angle grinder',
        category: 'Angle Grinders',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 12,
        current_stock: 12,
        unit: 'pieces',
        threshold: 2,
        min_stock_level: 2,
        max_stock_level: 25,
        supplier_info: {
            name: 'Power Tools Lanka',
            contact: '0771234576'
        }
    },
    {
        name: 'Stanley Measuring Tape 5m',
        description: 'Professional measuring tape with magnetic tip',
        category: 'Measuring Tools',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 25,
        current_stock: 25,
        unit: 'pieces',
        threshold: 3,
        min_stock_level: 3,
        max_stock_level: 50,
        supplier_info: {
            name: 'Hand Tools Suppliers',
            contact: '0771234577'
        }
    },
    {
        name: 'Safety Helmet - White',
        description: 'Industrial safety helmet with adjustable strap',
        category: 'Safety Gear',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 40,
        current_stock: 40,
        unit: 'pieces',
        threshold: 5,
        min_stock_level: 5,
        max_stock_level: 80,
        supplier_info: {
            name: 'Safety Equipment Co.',
            contact: '0771234578'
        }
    },
    {
        name: 'Cement - Holcim 50kg',
        description: 'Premium quality Portland cement',
        category: 'Cement',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 200,
        current_stock: 200,
        unit: 'bags',
        threshold: 20,
        min_stock_level: 20,
        max_stock_level: 500,
        supplier_info: {
            name: 'Holcim Lanka Ltd',
            contact: '0112345682'
        }
    },

    // Additional categories - Paint & Chemicals (WM)
    {
        name: 'Emulsion Paint - White 4L',
        description: 'High quality interior emulsion paint',
        category: 'Paint & Chemicals',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 50,
        current_stock: 50,
        unit: 'liters',
        threshold: 5,
        min_stock_level: 5,
        max_stock_level: 100,
        supplier_info: {
            name: 'Dulux Paints Lanka',
            contact: '0771234580'
        }
    },
    {
        name: 'Primer - Universal 1L',
        description: 'Multi-surface primer for better paint adhesion',
        category: 'Paint & Chemicals',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 30,
        current_stock: 30,
        unit: 'liters',
        threshold: 3,
        min_stock_level: 3,
        max_stock_level: 60,
        supplier_info: {
            name: 'Paint Solutions Ltd',
            contact: '0771234581'
        }
    },

    // Electrical Items (WM)
    {
        name: 'PVC Conduit 20mm - 3m',
        description: 'Electrical conduit pipe for cable protection',
        category: 'Electrical Items',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        min_stock_level: 10,
        max_stock_level: 200,
        supplier_info: {
            name: 'Electrical Supplies Co.',
            contact: '0771234582'
        }
    },
    {
        name: 'Switch Socket - 2 Gang',
        description: 'Standard 2-gang electrical switch socket',
        category: 'Electrical Items',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 80,
        current_stock: 80,
        unit: 'pieces',
        threshold: 8,
        min_stock_level: 8,
        max_stock_level: 160,
        supplier_info: {
            name: 'Lanka Electric Ltd',
            contact: '0771234583'
        }
    },

    // Plumbing Supplies (WM)
    {
        name: 'PVC Pipe 4" - 3m',
        description: 'Heavy duty PVC drainage pipe',
        category: 'Plumbing Supplies',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 60,
        current_stock: 60,
        unit: 'pieces',
        threshold: 6,
        min_stock_level: 6,
        max_stock_level: 120,
        supplier_info: {
            name: 'Plumbing World Lanka',
            contact: '0771234584'
        }
    },
    {
        name: 'Elbow Joint 90° - 4"',
        description: '90 degree elbow joint for PVC pipes',
        category: 'Plumbing Supplies',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 40,
        current_stock: 40,
        unit: 'pieces',
        threshold: 4,
        min_stock_level: 4,
        max_stock_level: 80,
        supplier_info: {
            name: 'Pipe Fittings Lanka',
            contact: '0771234585'
        }
    },

    // Hardware & Fasteners (WM)
    {
        name: 'Concrete Nails 4" - 1kg Pack',
        description: 'Hardened steel nails for concrete',
        category: 'Hardware & Fasteners',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 25,
        current_stock: 25,
        unit: 'kg',
        threshold: 3,
        min_stock_level: 3,
        max_stock_level: 50,
        supplier_info: {
            name: 'Hardware Solutions',
            contact: '0771234586'
        }
    },
    {
        name: 'Bolts & Nuts Set M12',
        description: 'Galvanized bolts and nuts set',
        category: 'Hardware & Fasteners',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 200,
        current_stock: 200,
        unit: 'sets',
        threshold: 20,
        min_stock_level: 20,
        max_stock_level: 400,
        supplier_info: {
            name: 'Fastener Specialists',
            contact: '0771234587'
        }
    },

    // Tiles & Ceramics (WM)
    {
        name: 'Floor Tiles 60x60cm - White',
        description: 'Polished porcelain floor tiles',
        category: 'Tiles & Ceramics',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        min_stock_level: 10,
        max_stock_level: 200,
        supplier_info: {
            name: 'Ceylon Tiles Ltd',
            contact: '0771234588'
        }
    },
    {
        name: 'Wall Tiles 30x30cm - Beige',
        description: 'Ceramic wall tiles for bathrooms',
        category: 'Tiles & Ceramics',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 150,
        current_stock: 150,
        unit: 'pieces',
        threshold: 15,
        min_stock_level: 15,
        max_stock_level: 300,
        supplier_info: {
            name: 'Tile Gallery Lanka',
            contact: '0771234589'
        }
    },

    // Roofing Materials (WM)
    {
        name: 'Asbestos Sheets 8ft',
        description: 'Corrugated roofing sheets',
        category: 'Roofing Materials',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 50,
        current_stock: 50,
        unit: 'sheets',
        threshold: 5,
        min_stock_level: 5,
        max_stock_level: 100,
        supplier_info: {
            name: 'Roofing Solutions Lanka',
            contact: '0771234590'
        }
    },
    {
        name: 'Ridge Tiles - Clay',
        description: 'Traditional clay ridge tiles',
        category: 'Roofing Materials',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 80,
        current_stock: 80,
        unit: 'pieces',
        threshold: 8,
        min_stock_level: 8,
        max_stock_level: 160,
        supplier_info: {
            name: 'Clay Roof Tiles Co.',
            contact: '0771234591'
        }
    },

    // General Categories for Admin/Mixed Use
    // Steel & Reinforcement (General - W3)
    {
        name: 'Steel Bars - Mixed Sizes',
        description: 'Assorted steel reinforcement bars',
        category: 'Steel & Reinforcement',
        warehouse: 'W3',
        warehouseCode: 'W3',
        location: 'W3',
        quantity: 100,
        current_stock: 100,
        unit: 'pieces',
        threshold: 10,
        min_stock_level: 10,
        max_stock_level: 200,
        supplier_info: {
            name: 'Steel Suppliers Lanka',
            contact: '0771234592'
        }
    },

    // Sand & Aggregate (General - W1)
    {
        name: 'Construction Sand - Mixed',
        description: 'General purpose construction sand',
        category: 'Sand & Aggregate',
        warehouse: 'W1',
        warehouseCode: 'W1',
        location: 'W1',
        quantity: 400,
        current_stock: 400,
        unit: 'cubic_ft',
        threshold: 40,
        min_stock_level: 40,
        max_stock_level: 800,
        supplier_info: {
            name: 'Aggregate Suppliers',
            contact: '0771234593'
        }
    },

    // Bricks (General - W2)
    {
        name: 'Building Bricks - Standard',
        description: 'General purpose building bricks',
        category: 'Bricks',
        warehouse: 'W2',
        warehouseCode: 'W2',
        location: 'W2',
        quantity: 1000,
        current_stock: 1000,
        unit: 'pieces',
        threshold: 100,
        min_stock_level: 100,
        max_stock_level: 2000,
        supplier_info: {
            name: 'Brick Manufacturers',
            contact: '0771234594'
        }
    },

    // Masonry Blocks (W2)
    {
        name: 'Concrete Masonry Blocks',
        description: 'Standard concrete masonry units',
        category: 'Masonry Blocks',
        warehouse: 'W2',
        warehouseCode: 'W2',
        location: 'W2',
        quantity: 500,
        current_stock: 500,
        unit: 'pieces',
        threshold: 50,
        min_stock_level: 50,
        max_stock_level: 1000,
        supplier_info: {
            name: 'Masonry Products Ltd',
            contact: '0771234595'
        }
    },

    // Stones (W1)
    {
        name: 'Decorative Garden Stones',
        description: 'Natural decorative stones for landscaping',
        category: 'Stones',
        warehouse: 'W1',
        warehouseCode: 'W1',
        location: 'W1',
        quantity: 200,
        current_stock: 200,
        unit: 'kg',
        threshold: 20,
        min_stock_level: 20,
        max_stock_level: 400,
        supplier_info: {
            name: 'Stone & Gravel Co.',
            contact: '0771234596'
        }
    },

    // Tools & Equipment (General - WM)
    {
        name: 'Construction Tool Set',
        description: 'Complete construction hand tools set',
        category: 'Tools & Equipment',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 10,
        current_stock: 10,
        unit: 'sets',
        threshold: 1,
        min_stock_level: 1,
        max_stock_level: 20,
        supplier_info: {
            name: 'Tool Center Lanka',
            contact: '0771234597'
        }
    },

    // Safety Equipment (General - WM)
    {
        name: 'Safety Equipment Kit',
        description: 'Complete worker safety equipment set',
        category: 'Safety Equipment',
        warehouse: 'WM',
        warehouseCode: 'WM',
        location: 'WM',
        quantity: 15,
        current_stock: 15,
        unit: 'sets',
        threshold: 2,
        min_stock_level: 2,
        max_stock_level: 30,
        supplier_info: {
            name: 'Safety First Lanka',
            contact: '0771234598'
        }
    }
];

const resetAndPopulateInventory = async () => {
    try {
        await connectDB();

        // Find or create a system user for created_by field
        let systemUser = await User.findOne({ email: 'system@toollink.com' });
        if (!systemUser) {
            console.log('👤 Creating system user...');
            systemUser = new User({
                username: 'system_admin',
                fullName: 'System Administrator',
                email: 'system@toollink.com',
                phone: '0000000000',
                role: 'admin',
                password: 'system123' // This will be hashed automatically
            });
            await systemUser.save();
            console.log('✅ System user created');
        }

        console.log('🗑️  Clearing existing inventory...');
        const deleteResult = await Inventory.deleteMany({});
        console.log(`✅ Deleted ${deleteResult.deletedCount} existing inventory items`);

        console.log('\n📦 Adding new inventory items...');

        for (let i = 0; i < newInventoryItems.length; i++) {
            const item = newInventoryItems[i];
            try {
                const itemWithUser = {
                    ...item,
                    created_by: systemUser._id
                };
                const newItem = new Inventory(itemWithUser);
                await newItem.save();
                console.log(`✅ Added: ${item.name} (${item.warehouse})`);
            } catch (error) {
                console.error(`❌ Failed to add ${item.name}:`, error.message);
            }
        }

        console.log('\n🎉 Inventory reset and population completed!');

        // Show summary
        const summary = await Inventory.aggregate([
            {
                $group: {
                    _id: '$warehouse',
                    count: { $sum: 1 },
                    items: { $push: '$name' }
                }
            }
        ]);

        console.log('\n📊 Summary by Warehouse:');
        summary.forEach(warehouse => {
            console.log(`${warehouse._id}: ${warehouse.count} items`);
            warehouse.items.forEach(item => {
                console.log(`   - ${item}`);
            });
        });

        mongoose.connection.close();
        console.log('\n✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error during inventory reset:', error);
        mongoose.connection.close();
    }
};

resetAndPopulateInventory();
