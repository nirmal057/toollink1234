const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/toollink')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection failed:', err));

const orderSchema = new mongoose.Schema({
    orderNumber: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerEmail: String, // Add this field
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

async function addCustomerEmailToOrders() {
    try {
        console.log('=== ADDING CUSTOMER EMAIL TO ORDERS ===\n');

        // Get all orders that don't have customerEmail field
        const ordersWithoutEmail = await Order.find({
            customerEmail: { $exists: false }
        }).populate('customer');

        console.log(`Found ${ordersWithoutEmail.length} orders without customerEmail field`);

        if (ordersWithoutEmail.length === 0) {
            console.log('✅ All orders already have customerEmail field');
            return;
        }

        // Update each order to include customer email
        let updatedCount = 0;

        for (const order of ordersWithoutEmail) {
            if (order.customer && order.customer.email) {
                await Order.updateOne(
                    { _id: order._id },
                    { $set: { customerEmail: order.customer.email } }
                );

                console.log(`✅ Updated order ${order.orderNumber} with email: ${order.customer.email}`);
                updatedCount++;
            } else {
                console.log(`⚠️  Order ${order.orderNumber} has no customer or email`);
            }
        }

        console.log(`\n🎉 Successfully updated ${updatedCount} orders with customer emails`);

        // Verify the updates
        console.log('\n=== VERIFICATION ===');
        const updatedOrders = await Order.find({ customerEmail: { $exists: true } }).populate('customer');

        console.log(`Total orders with customerEmail: ${updatedOrders.length}`);
        updatedOrders.forEach(order => {
            console.log(`- ${order.orderNumber}: ${order.customerEmail} (${order.customer?.fullName})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}

addCustomerEmailToOrders();
