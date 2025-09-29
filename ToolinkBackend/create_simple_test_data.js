import mongoose from 'mongoose';
import SubOrder from './src/models/SubOrder.js';
import MainOrder from './src/models/MainOrder.js';
import Material from './src/models/Material.js';
import User from './src/models/User.js';
import Warehouse from './src/models/Warehouse.js';
import dotenv from 'dotenv';

dotenv.config();

async function createSimpleTestData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/toollink');
        console.log('✅ Connected to MongoDB');

        console.log('\n=== CREATING SIMPLE TEST DATA FOR MY DELIVERIES PAGE ===');

        // Get warehouse users
        const warehouseUsers = await User.find({
            role: 'warehouse',
            email: { $in: ['house1@toollink.com', 'house2@toollink.com', 'house3@toollink.com', 'main_house@toollink.com'] }
        });

        console.log(`Found ${warehouseUsers.length} warehouse users`);

        // Get or create warehouses
        const warehouses = await createTestWarehouses();
        console.log(`Prepared ${warehouses.length} warehouses`);

        // Get test customer
        let customer = await User.findOne({ role: 'customer' });
        if (!customer) {
            customer = new User({
                username: 'testcustomer',
                email: 'test.customer@example.com',
                password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeESQ5bg0RA9JHKxG',
                fullName: 'Test Customer',
                role: 'customer',
                isActive: true,
                isApproved: true,
                emailVerified: true
            });
            await customer.save();
        }
        console.log(`Using customer: ${customer.email}`);

        // Create test materials
        const materials = await createSimpleTestMaterials();
        console.log(`Created ${materials.length} materials`);

        // Create a simple main order first
        const mainOrder = new MainOrder({
            customerId: customer._id,
            items: [
                {
                    materialId: materials[0]._id,
                    requestedQty: 100,
                    unitPrice: materials[0].sellingPrice,
                    totalPrice: 100 * materials[0].sellingPrice
                }
            ],
            deliveryAddress: {
                street: '123 Test Street',
                city: 'Test City',
                state: 'Test State',
                zipCode: '12345'
            },
            scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            scheduledTime: '10:00',
            requestedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdBy: customer._id,
            status: 'split_scheduled'
        });

        await mainOrder.save();
        console.log(`✅ Created main order: ${mainOrder.orderNumber}`);

        // Create test sub-orders for each warehouse
        const testSubOrders = [
            {
                warehouseCode: 'W1',
                materialCategory: 'Aggregates',
                materials: materials.filter(m => m.category === 'Aggregates')
            },
            {
                warehouseCode: 'W2',
                materialCategory: 'Cement',
                materials: materials.filter(m => m.category === 'Cement')
            },
            {
                warehouseCode: 'W3',
                materialCategory: 'Steel & Reinforcement',
                materials: materials.filter(m => m.category === 'Steel & Reinforcement')
            },
            {
                warehouseCode: 'WM',
                materialCategory: 'Tools & Equipment',
                materials: materials.filter(m => m.category === 'Tools & Equipment')
            }
        ];

        let subOrderCount = 1;
        for (const testData of testSubOrders) {
            if (testData.materials.length === 0) continue;

            const warehouse = warehouses.find(w => w.code === testData.warehouseCode) || warehouses[0];

            for (let i = 0; i < 2; i++) { // Create 2 sub-orders per warehouse
                const material = testData.materials[0];
                const subOrder = new SubOrder({
                    subOrderNumber: `${mainOrder.orderNumber}-${testData.warehouseCode}-${String(i + 1).padStart(2, '0')}`,
                    mainOrderId: mainOrder._id,
                    warehouseId: warehouse._id,
                    warehouseCode: testData.warehouseCode,
                    materialCategory: testData.materialCategory,
                    items: [{
                        materialId: material._id,
                        materialName: material.name,
                        qty: 50 + (i * 25),
                        unitPrice: material.sellingPrice,
                        totalPrice: (50 + (i * 25)) * material.sellingPrice
                    }],
                    totalAmount: (50 + (i * 25)) * material.sellingPrice,
                    scheduledAt: new Date(Date.now() + (subOrderCount * 24 * 60 * 60 * 1000)),
                    scheduledTime: `${9 + subOrderCount}:00`,
                    status: ['created', 'scheduled', 'prepared'][Math.floor(Math.random() * 3)]
                });

                await subOrder.save();
                console.log(`  ✅ Created sub-order: ${subOrder.subOrderNumber} (${testData.warehouseCode})`);
                subOrderCount++;
            }
        }

        // Verify the data
        console.log('\n=== VERIFICATION ===');
        for (const warehouseCode of ['W1', 'W2', 'W3', 'WM']) {
            const subOrders = await SubOrder.find({ warehouseCode }).countDocuments();
            console.log(`${warehouseCode}: ${subOrders} sub-orders`);
        }

        console.log('\n🎉 TEST DATA CREATION COMPLETE!');
        console.log('You can now test the My Deliveries page:');
        console.log('- Login as house1@toollink.com (password: 123456) for W1');
        console.log('- Login as house2@toollink.com (password: 123456) for W2');
        console.log('- Login as house3@toollink.com (password: 123456) for W3');
        console.log('- Login as main_house@toollink.com (password: 123456) for WM');

    } catch (error) {
        console.error('❌ Error creating test data:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

async function createTestWarehouses() {
    const testWarehouses = [
        { name: 'W1 Sand & Aggregates Warehouse', code: 'W1', location: 'Location W1' },
        { name: 'W2 Blocks & Masonry Warehouse', code: 'W2', location: 'Location W2' },
        { name: 'W3 Steel & Metal Warehouse', code: 'W3', location: 'Location W3' },
        { name: 'WM Tools & Equipment Warehouse', code: 'WM', location: 'Location WM' }
    ];

    const warehouses = [];

    for (const warehouseData of testWarehouses) {
        let warehouse = await Warehouse.findOne({ code: warehouseData.code });
        if (!warehouse) {
            warehouse = new Warehouse({
                ...warehouseData,
                isActive: true,
                capacity: 1000,
                contactInfo: {
                    phone: '+94 11 123 456' + warehouseData.code.charAt(1),
                    email: `${warehouseData.code.toLowerCase()}@toollink.com`
                }
            });
            await warehouse.save();
        }
        warehouses.push(warehouse);
    }

    return warehouses;
}

async function createSimpleTestMaterials() {
    const materials = [];
    const testMaterials = [
        { name: 'Sand', category: 'Aggregates', unit: 'ton', sellingPrice: 45.00, sku: 'SAND001' },
        { name: 'Cement', category: 'Cement', unit: 'bag', sellingPrice: 12.50, sku: 'CEM001' },
        { name: 'Steel Rebar', category: 'Steel & Reinforcement', unit: 'piece', sellingPrice: 8.75, sku: 'STEEL001' },
        { name: 'Hammer', category: 'Tools & Equipment', unit: 'piece', sellingPrice: 25.99, sku: 'TOOL001' }
    ];

    for (const materialData of testMaterials) {
        let material = await Material.findOne({ sku: materialData.sku });
        if (!material) {
            material = new Material({
                ...materialData,
                description: `Test ${materialData.name}`,
                isActive: true,
                stockQuantity: 1000
            });
            await material.save();
        }
        materials.push(material);
    }

    return materials;
}

createSimpleTestData();
