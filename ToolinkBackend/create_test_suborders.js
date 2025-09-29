import mongoose from 'mongoose';
import MainOrder from './src/models/MainOrder.js';
import SubOrder from './src/models/SubOrder.js';
import Material from './src/models/Material.js';
import User from './src/models/User.js';
import Warehouse from './src/models/Warehouse.js';
import OrderService from './src/services/OrderService.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestSubOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/toollink');
        console.log('✅ Connected to MongoDB');

        console.log('\n=== CREATING TEST SUB-ORDERS FOR WAREHOUSE SEPARATION ===');

        // Get or create test materials for each category
        const materials = await createTestMaterials();
        console.log(`✅ Created/found ${Object.keys(materials).length} test materials`);
        console.log('Materials:', Object.keys(materials));

        // Get a test customer
        let customer = await User.findOne({ role: 'customer' });
        if (!customer) {
            customer = new User({
                username: 'testcustomer',
                email: 'test.customer@example.com',
                password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeESQ5bg0RA9JHKxG', // 123456 hashed
                fullName: 'Test Customer',
                role: 'customer',
                isActive: true,
                isApproved: true,
                emailVerified: true
            });
            await customer.save();
            console.log('✅ Created test customer');
        }

        // Create test main orders that will be split into warehouse-specific sub-orders
        const testOrders = [
            {
                name: 'Mixed Construction Materials Order 1',
                items: [
                    { materialId: materials.sand._id, requestedQty: 100 },
                    { materialId: materials.cement._id, requestedQty: 50 },
                    { materialId: materials.steel._id, requestedQty: 20 }
                ]
            },
            {
                name: 'Tools and Equipment Order',
                items: [
                    { materialId: materials.hammer._id, requestedQty: 5 },
                    { materialId: materials.drill._id, requestedQty: 2 }
                ]
            },
            {
                name: 'Large Construction Project Order',
                items: [
                    { materialId: materials.sand._id, requestedQty: 200 },
                    { materialId: materials.cement._id, requestedQty: 100 },
                    { materialId: materials.steel._id, requestedQty: 50 },
                    { materialId: materials.hammer._id, requestedQty: 10 }
                ]
            }
        ];

        const orderService = OrderService;

        for (const testOrder of testOrders) {
            try {
                console.log(`\n📋 Creating order: ${testOrder.name}`);

                const scheduleDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

                const mainOrder = await orderService.createMainOrder({
                    customerId: customer._id,
                    items: testOrder.items,
                    scheduledDate: scheduleDate,
                    scheduledTime: '10:00',
                    requestedDeliveryDate: scheduleDate,
                    notes: `Test order for warehouse separation - ${testOrder.name}`,
                    deliveryAddress: {
                        street: '123 Test Street',
                        city: 'Test City',
                        state: 'Test State',
                        zipCode: '12345'
                    }
                }, customer._id);

                console.log(`   ✅ Created main order: ${mainOrder.orderNumber}`);
                console.log(`   📦 Items: ${testOrder.items.length}`);

            } catch (error) {
                console.error(`   ❌ Error creating order ${testOrder.name}:`, error.message);
            }
        }

        // Check created sub-orders by warehouse
        console.log('\n=== VERIFYING SUB-ORDERS BY WAREHOUSE ===');

        const warehouseCodes = ['W1', 'W2', 'W3', 'WM'];
        for (const code of warehouseCodes) {
            const subOrders = await SubOrder.find({ warehouseCode: code })
                .populate('mainOrderId', 'orderNumber')
                .populate('items.materialId', 'name');

            console.log(`\n🏭 ${code} Warehouse:`);
            if (subOrders.length === 0) {
                console.log('   📭 No sub-orders found');
            } else {
                subOrders.forEach(subOrder => {
                    console.log(`   📦 ${subOrder.subOrderNumber} (from ${subOrder.mainOrderId.orderNumber})`);
                    console.log(`      Items: ${subOrder.items.length}, Amount: $${subOrder.totalAmount}`);
                    subOrder.items.forEach(item => {
                        console.log(`        - ${item.materialName} (${item.qty} units)`);
                    });
                });
            }
        }

        console.log('\n🎉 TEST SUB-ORDERS CREATION COMPLETE!');
        console.log('You can now test the My Deliveries page with warehouse users.');

    } catch (error) {
        console.error('❌ Error creating test sub-orders:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

async function createTestMaterials() {
    const materials = {};

    const testMaterials = [
        { name: 'Construction Sand', category: 'Aggregates', unit: 'ton', sellingPrice: 45.00, sku: 'SAND001' },
        { name: 'Portland Cement', category: 'Cement', unit: 'bag', sellingPrice: 12.50, sku: 'CEM001' },
        { name: 'Steel Rebar #4', category: 'Steel & Reinforcement', unit: 'piece', sellingPrice: 8.75, sku: 'STEEL001' },
        { name: 'Claw Hammer', category: 'Tools & Equipment', unit: 'piece', sellingPrice: 25.99, sku: 'TOOL001' },
        { name: 'Power Drill', category: 'Tools & Equipment', unit: 'piece', sellingPrice: 89.99, sku: 'TOOL002' }
    ];

    for (const materialData of testMaterials) {
        let material = await Material.findOne({ name: materialData.name });
        if (!material) {
            material = new Material({
                ...materialData,
                description: `Test ${materialData.name} for warehouse separation testing`,
                isActive: true,
                stockQuantity: 1000
            });
            await material.save();
        }

        const key = materialData.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        if (key.includes('sand')) materials.sand = material;
        else if (key.includes('cement')) materials.cement = material;
        else if (key.includes('steel') || key.includes('rebar')) materials.steel = material;
        else if (key.includes('hammer')) materials.hammer = material;
        else if (key.includes('drill')) materials.drill = material;
    }

    return materials;
}

createTestSubOrders();
