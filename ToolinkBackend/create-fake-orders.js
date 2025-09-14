import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import models
import User from './src/models/User.js';
import Order from './src/models/Order.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolink';

console.log('🛒 Creating fake orders for customers...');

async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function createFakeOrders() {
    try {
        // Get customers
        const customers = await User.find({ role: 'customer' });
        console.log(`\n👥 Found ${customers.length} customers`);

        if (customers.length === 0) {
            console.log('❌ No customers found. Please add customers first.');
            return;
        }

        console.log('\nCustomers:');
        customers.forEach((customer, index) => {
            console.log(`${index + 1}. ${customer.fullName || customer.username} (ID: ${customer._id})`);
        });

        // Create fake orders for each customer
        let orderCounter = 1;

        for (const customer of customers) {
            const numOrders = Math.floor(Math.random() * 3) + 2; // 2-4 orders per customer
            console.log(`\n📝 Creating ${numOrders} orders for ${customer.fullName || customer.username}...`);

            for (let i = 0; i < numOrders; i++) {
                await createFakeOrderForCustomer(customer, orderCounter);
                orderCounter++;
                // Small delay to ensure unique timestamps
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Show final statistics
        console.log('\n📊 Final Order Summary:');
        const totalOrders = await Order.countDocuments();
        console.log(`- Total orders created: ${totalOrders}`);

        for (const customer of customers) {
            const customerOrders = await Order.find({ customer: customer._id });
            console.log(`\n👤 ${customer.fullName || customer.username} (ID: ${customer._id}):`);
            console.log(`  - Number of orders: ${customerOrders.length}`);

            customerOrders.forEach((order, index) => {
                console.log(`  ${index + 1}. Order #${order.orderNumber} - $${order.finalAmount.toFixed(2)} (${order.status})`);
            });
        }

    } catch (error) {
        console.error('❌ Error creating fake orders:', error);
        throw error;
    }
}

async function createFakeOrderForCustomer(customer, orderIndex) {
    try {
        // Generate unique order number
        const timestamp = Date.now();
        const orderNumber = `ORD${timestamp}${orderIndex.toString().padStart(3, '0')}`;

        // Fake product data - no inventory validation needed
        const fakeProducts = [
            { name: 'Portland Cement 50kg', price: 25.50 },
            { name: 'Steel Rebar 12mm', price: 45.00 },
            { name: 'White Paint 4L', price: 35.75 },
            { name: 'Red Bricks (pack of 100)', price: 75.00 },
            { name: 'Ceramic Floor Tiles', price: 12.50 },
            { name: 'Roofing Sheets', price: 85.00 },
            { name: 'PVC Pipes 4 inch', price: 18.25 },
            { name: 'Sand (1 cubic meter)', price: 65.00 },
            { name: 'Gravel (1 cubic meter)', price: 55.00 },
            { name: 'Electrical Wire 10m', price: 28.75 }
        ];

        // Select 1-4 random products
        const numItems = Math.floor(Math.random() * 4) + 1;
        const selectedItems = [];
        const usedIndices = new Set();

        for (let i = 0; i < numItems; i++) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * fakeProducts.length);
            } while (usedIndices.has(randomIndex));

            usedIndices.add(randomIndex);
            const product = fakeProducts[randomIndex];
            const quantity = Math.floor(Math.random() * 10) + 1; // 1-10 items
            const unitPrice = product.price;
            const totalPrice = Math.round(quantity * unitPrice * 100) / 100;

            selectedItems.push({
                // Create a fake ObjectId for inventory reference
                inventory: new mongoose.Types.ObjectId(),
                quantity: quantity,
                unitPrice: unitPrice,
                totalPrice: totalPrice,
                notes: `${product.name} - Quality construction material`
            });
        }

        // Calculate totals
        const totalAmount = Math.round(selectedItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
        const tax = Math.round(totalAmount * 0.1 * 100) / 100; // 10% tax
        const discount = Math.round(Math.random() * 10 * 100) / 100; // Random discount 0-10
        const finalAmount = Math.round((totalAmount + tax - discount) * 100) / 100;

        // Random order data
        const statuses = ['pending', 'confirmed', 'processing', 'shipped'];
        const priorities = ['low', 'medium', 'high'];
        const paymentStatuses = ['pending', 'paid', 'partial'];
        const paymentMethods = ['cash', 'card', 'bank_transfer'];
        const cities = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Matara'];

        // Create order with customer ID link
        const order = new Order({
            orderNumber: orderNumber,
            customer: customer._id, // This is the key connection!
            items: selectedItems,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            priority: priorities[Math.floor(Math.random() * priorities.length)],
            totalAmount: totalAmount,
            discount: discount,
            tax: tax,
            finalAmount: finalAmount,
            paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
            paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
            shippingAddress: {
                street: `${Math.floor(Math.random() * 999) + 1} ${['Main', 'Galle', 'Kandy', 'Temple'][Math.floor(Math.random() * 4)]} Road`,
                city: cities[Math.floor(Math.random() * cities.length)],
                state: 'Western Province',
                zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
                country: 'Sri Lanka',
                phone: `+94${Math.floor(Math.random() * 900000000) + 100000000}`,
                instructions: 'Please call before delivery'
            },
            delivery: {
                method: 'delivery',
                estimatedDate: new Date(Date.now() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000), // Random date within 14 days
                notes: 'Handle with care - construction materials'
            },
            notes: `Order placed by ${customer.fullName || customer.username} (Customer ID: ${customer._id})`,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000) // Random date within last 60 days
        });

        await order.save();
        console.log(`✅ Created order ${orderNumber} for ${customer.fullName || customer.username} - $${finalAmount.toFixed(2)} (Customer ID: ${customer._id})`);

        return order;

    } catch (error) {
        console.error(`❌ Error creating order for ${customer.username}:`, error.message);
        return null;
    }
}

async function main() {
    try {
        await connectDatabase();
        await createFakeOrders();
        console.log('\n🎉 Fake orders created successfully! Each order is properly linked to its customer ID.');
    } catch (error) {
        console.error('\n💥 Process failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the script
main();
