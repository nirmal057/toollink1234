const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/toollink')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection failed:', err));

// Define user schema
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    fullName: String,
    role: String,
    phone: String,
    address: String
});

const User = mongoose.model('User', userSchema);

async function checkCustomerData() {
    try {
        console.log('=== Customer Data Check ===\n');

        const customers = await User.find({ role: 'customer' }).lean();

        for (const customer of customers) {
            console.log(`Customer: ${customer.fullName} (${customer.email})`);
            console.log(`ID: ${customer._id}`);
            console.log(`Password: ${customer.password.substring(0, 20)}...`);
            console.log(`Phone: ${customer.phone}`);
            console.log('---');
        }

        // Also check admin for comparison
        const admin = await User.findOne({ role: 'admin' }).lean();
        if (admin) {
            console.log(`\nAdmin: ${admin.fullName || admin.email}`);
            console.log(`Password: ${admin.password.substring(0, 20)}...`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}

checkCustomerData();
