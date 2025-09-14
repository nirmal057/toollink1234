import mongoose from 'mongoose';
import Order from './src/models/Order.js';
import Delivery from './src/models/Delivery.js';
import User from './src/models/User.js';

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function createSampleDeliveries() {
    await connectDB();

    try {
        console.log('📦 Creating sample orders and deliveries...');

        // Get a customer to use for orders
        const customer = await User.findOne({ role: 'customer' });
        if (!customer) {
            console.log('❌ No customers found. Creating a sample customer...');

            const sampleCustomer = new User({
                username: 'customer1',
                email: 'customer1@test.com',
                password: 'customer123',
                fullName: 'Test Customer',
                phone: '+94771234567',
                role: 'customer',
                isApproved: true,
                isActive: true,
                emailVerified: true
            });

            await sampleCustomer.save();
            console.log('✅ Sample customer created');
            customer = sampleCustomer;
        }

        // Create sample orders
        const order1 = new Order({
            orderNumber: 'ORD-2025-001',
            customerId: customer._id,
            items: [
                {
                    name: 'Cement Bags',
                    quantity: 10,
                    price: 1200,
                    total: 12000
                }
            ],
            totalAmount: 12000,
            status: 'confirmed',
            customerInfo: {
                name: customer.fullName,
                email: customer.email,
                phone: customer.phone
            }
        });

        await order1.save();
        console.log('✅ Order 1 created');

        const order2 = new Order({
            orderNumber: 'ORD-2025-002',
            customerId: customer._id,
            items: [
                {
                    name: 'Steel Bars',
                    quantity: 5,
                    price: 2500,
                    total: 12500
                }
            ],
            totalAmount: 12500,
            status: 'confirmed',
            customerInfo: {
                name: customer.fullName,
                email: customer.email,
                phone: customer.phone
            }
        });

        await order2.save();
        console.log('✅ Order 2 created');

        // Create unassigned deliveries
        const delivery1 = new Delivery({
            orderId: order1._id,
            customerName: customer.fullName,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            deliveryAddress: '123 Main Street, Colombo 03, Sri Lanka',
            status: 'pending',
            priority: 'normal',
            specialInstructions: 'Call before delivery',
            estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
        });

        await delivery1.save();
        console.log('✅ Delivery 1 created (unassigned)');

        const delivery2 = new Delivery({
            orderId: order2._id,
            customerName: customer.fullName,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            deliveryAddress: '456 Park Avenue, Kandy, Sri Lanka',
            status: 'pending',
            priority: 'high',
            specialInstructions: 'Handle with care - fragile items',
            estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
        });

        await delivery2.save();
        console.log('✅ Delivery 2 created (unassigned)');

        const delivery3 = new Delivery({
            orderId: order1._id,
            customerName: 'Another Customer',
            customerEmail: 'another@test.com',
            customerPhone: '+94772345678',
            deliveryAddress: '789 Beach Road, Galle, Sri Lanka',
            status: 'pending',
            priority: 'normal',
            specialInstructions: 'Weekend delivery preferred',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        });

        await delivery3.save();
        console.log('✅ Delivery 3 created (unassigned)');

        // Verify creation
        const deliveryCount = await Delivery.countDocuments({});
        console.log(`\n📊 Total deliveries in database: ${deliveryCount}`);

        const unassignedDeliveries = await Delivery.find({
            $or: [
                { driverId: { $exists: false } },
                { driverId: null },
                { status: 'pending' }
            ]
        }).populate('orderId', 'orderNumber');

        console.log(`📦 Unassigned deliveries: ${unassignedDeliveries.length}`);

        unassignedDeliveries.forEach((delivery, index) => {
            console.log(`\n${index + 1}. Delivery ID: ${delivery._id}`);
            console.log(`   📋 Order: ${delivery.orderId?.orderNumber}`);
            console.log(`   👤 Customer: ${delivery.customerName}`);
            console.log(`   📍 Address: ${delivery.deliveryAddress}`);
            console.log(`   ⚡ Priority: ${delivery.priority}`);
            console.log(`   📝 Notes: ${delivery.specialInstructions}`);
        });

    } catch (error) {
        console.error('❌ Error creating sample deliveries:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Database connection closed');
    }
}

// Run the creation
createSampleDeliveries();
