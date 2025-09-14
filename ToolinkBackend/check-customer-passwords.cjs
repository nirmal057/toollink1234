const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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

async function checkCustomerPasswords() {
    try {
        console.log('=== Customer Password Check ===\n');

        const customers = await User.find({ role: 'customer' }).lean();

        for (const customer of customers) {
            console.log(`Customer: ${customer.fullName} (${customer.email})`);
            console.log(`Password hash: ${customer.password}`);

            // Test if password is 'customer123'
            if (customer.password.startsWith('$2b$')) {
                // It's already hashed, test with bcrypt
                const isValid = await bcrypt.compare('customer123', customer.password);
                console.log(`Password 'customer123' valid: ${isValid}`);

                // Also test other common passwords
                const isValidDefault = await bcrypt.compare('password123', customer.password);
                console.log(`Password 'password123' valid: ${isValidDefault}`);
            } else {
                // It's plain text
                console.log(`Plain text password: ${customer.password}`);
            }
            console.log('---');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}

checkCustomerPasswords();
