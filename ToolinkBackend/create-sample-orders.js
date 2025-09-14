import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import models
import User from './src/models/User.js';
import Order from './src/models/Order.js';
import Inventory from './src/models/Inventory.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolink';

console.log('🛒 Creating sample orders for customers...');

async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function createSampleOrders() {
    try {
        // Get customers
        const customers = await User.find({ role: 'customer' });
        console.log(`\n👥 Found ${customers.length} customers`);

        if (customers.length === 0) {
            console.log('❌ No customers found. Please add customers first.');
            return;
        }

        // First, create sample inventory
        console.log('\n📦 Creating sample inventory...');
        await createSampleInventory();

        // Get the created inventory
        const inventory = await Inventory.find({ quantity: { $gt: 0 } });
        console.log(`\n📦 Found ${inventory.length} inventory items`);

        if (inventory.length === 0) {
            console.log('❌ Still no inventory items found after creation.');
            return;
        }

        console.log('\nAvailable inventory:');
        inventory.forEach((item, index) => {
            console.log(`${index + 1}. ${item.name} - $${item.unit_price || 0} (Stock: ${item.quantity})`);
        });

        // Create orders for each customer
        let orderCounter = 1;
        for (const customer of customers) {
            const numOrders = Math.floor(Math.random() * 3) + 1; // 1-3 orders per customer

            for (let i = 0; i < numOrders; i++) {
                await createOrderForCustomer(customer, inventory, orderCounter);
                orderCounter++;
            }
        }

        // Show final statistics
        const totalOrders = await Order.countDocuments();
        console.log(`\n📊 Final statistics:`);
        console.log(`- Total orders created: ${totalOrders}`);

        for (const customer of customers) {
            const customerOrders = await Order.countDocuments({ customer: customer._id });
            console.log(`- ${customer.fullName || customer.username}: ${customerOrders} orders`);
        }

    } catch (error) {
        console.error('❌ Error creating orders:', error);
        throw error;
    }
}

async function createSampleInventory() {
    const sampleItems = [
        {
            name: "Portland Cement 50kg",
            description: "High quality Portland cement for construction",
            category: "Cement",
            sku: "CEM001",
            quantity: 500,
            current_stock: 500,
            unit_price: 25.50,
            minimum_stock: 50,
            maximum_stock: 1000,
            unit: "bag"
        },
        {
            name: "Steel Rebar 12mm",
            description: "Steel reinforcement bar 12mm diameter",
            category: "Steel & Reinforcement",
            sku: "STL001",
            quantity: 200,
            current_stock: 200,
            unit_price: 45.00,
            minimum_stock: 20,
            maximum_stock: 500,
            unit: "piece"
        },
        {
            name: "White Paint 4L",
            description: "Premium white wall paint",
            category: "Paint & Chemicals",
            sku: "PNT001",
            quantity: 100,
            current_stock: 100,
            unit_price: 35.75,
            minimum_stock: 10,
            maximum_stock: 200,
            unit: "can"
        },
        {
            name: "Red Bricks",
            description: "Standard red clay bricks",
            category: "Bricks",
            sku: "BRK001",
            quantity: 1000,
            current_stock: 1000,
            unit_price: 0.75,
            minimum_stock: 100,
            maximum_stock: 2000,
            unit: "piece"
        },
        {
            name: "Ceramic Floor Tiles",
            description: "Premium ceramic floor tiles 600x600mm",
            category: "Tiles & Ceramics",
            sku: "TIL001",
            quantity: 300,
            current_stock: 300,
            unit_price: 12.50,
            minimum_stock: 30,
            maximum_stock: 500,
            unit: "piece"
        }
    ];

    console.log('\n📦 Creating sample inventory...');

    for (const item of sampleItems) {
        const existingItem = await Inventory.findOne({ sku: item.sku });
        if (!existingItem) {
            await Inventory.create(item);
            console.log(`✅ Created: ${item.name}`);
        }
    }

    console.log('✅ Sample inventory created');
}

async function createOrderForCustomer(customer, inventory, orderIndex) {
    try {
        // Generate order number
        const orderNumber = `ORD${Date.now()}${orderIndex.toString().padStart(3, '0')}`;

        // Select 1-3 random items from inventory
        const numItems = Math.floor(Math.random() * 3) + 1;
        const selectedItems = [];
        const usedIndices = new Set();

        for (let i = 0; i < numItems; i++) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * inventory.length);
            } while (usedIndices.has(randomIndex));

            usedIndices.add(randomIndex);
            const item = inventory[randomIndex];
            const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 items
            const unitPrice = parseFloat(item.unit_price) || 10.00; // Default price if not set
            const totalPrice = quantity * unitPrice;

            selectedItems.push({
                inventory: item._id,
                quantity: quantity,
                unitPrice: unitPrice,
                totalPrice: totalPrice,
                notes: `Quality ${item.name.toLowerCase()}`
            });
        }

        // Calculate totals
        const totalAmount = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const tax = Math.round(totalAmount * 0.1 * 100) / 100; // 10% tax, rounded to 2 decimals
        const finalAmount = Math.round((totalAmount + tax) * 100) / 100; // Rounded to 2 decimals

        // Create order
        const order = new Order({
            orderNumber: orderNumber,
            customer: customer._id,
            items: selectedItems,
            status: ['pending', 'confirmed', 'processing'][Math.floor(Math.random() * 3)],
            priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            totalAmount: totalAmount,
            tax: tax,
            finalAmount: finalAmount,
            paymentStatus: ['pending', 'paid'][Math.floor(Math.random() * 2)],
            paymentMethod: ['cash', 'card', 'bank_transfer'][Math.floor(Math.random() * 3)],
            shippingAddress: {
                street: `${Math.floor(Math.random() * 999) + 1} Main Street`,
                city: ['Colombo', 'Kandy', 'Galle', 'Jaffna'][Math.floor(Math.random() * 4)],
                state: 'Western Province',
                zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
                country: 'Sri Lanka',
                phone: `+94${Math.floor(Math.random() * 900000000) + 100000000}`,
                instructions: 'Please call before delivery'
            },
            delivery: {
                method: 'delivery',
                estimatedDate: new Date(Date.now() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000), // Random date within 7 days
                notes: 'Handle with care'
            },
            notes: `Order for ${customer.fullName || customer.username}`,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000) // Random date within last 30 days
        });

        await order.save();
        console.log(`✅ Created order ${orderNumber} for ${customer.fullName || customer.username} - $${finalAmount.toFixed(2)}`);

    } catch (error) {
        console.error(`❌ Error creating order for ${customer.username}:`, error.message);
    }
}

async function main() {
    try {
        await connectDatabase();
        await createSampleOrders();
        console.log('\n🎉 Sample orders created successfully!');
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
