const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/toollink')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection failed:', err));

const orderSchema = new mongoose.Schema({
    orderNumber: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{
        inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        name: String,
        quantity: Number,
        price: Number
    }],
    totalAmount: Number,
    status: String,
    shippingAddress: {
        street: String,
        city: String,
        zipCode: String,
        phone: String
    },
    delivery: {
        estimatedDate: Date,
        actualDate: Date
    },
    createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    fullName: String,
    role: String,
    phone: String,
    address: String
});

const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);

async function analyzeOrderStructure() {
    try {
        console.log('=== ANALYZING ORDER STRUCTURE ===\n');

        // Get a few orders with customer data
        const orders = await Order.find({}).populate('customer').limit(3).lean();

        console.log(`Found ${orders.length} orders. Analyzing structure:\n`);

        orders.forEach((order, index) => {
            console.log(`Order ${index + 1}: ${order.orderNumber}`);
            console.log(`Customer ID: ${order.customer?._id}`);
            console.log(`Customer Email: ${order.customer?.email}`);
            console.log(`Customer Name: ${order.customer?.fullName}`);
            console.log(`Direct Email Field: ${order.customerEmail || 'NOT PRESENT'}`);
            console.log('---');
        });

        // Check if orders have a direct customerEmail field
        console.log('\n=== CHECKING FOR DIRECT EMAIL FIELD ===');
        const orderWithEmail = await Order.findOne({ customerEmail: { $exists: true } });

        if (orderWithEmail) {
            console.log('✅ Orders already have customerEmail field');
            console.log('Sample customerEmail:', orderWithEmail.customerEmail);
        } else {
            console.log('❌ Orders do NOT have direct customerEmail field');
            console.log('💡 Need to add customerEmail field to orders');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}

analyzeOrderStructure();
