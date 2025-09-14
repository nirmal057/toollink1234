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

async function resetCustomerPasswords() {
    try {
        console.log('=== Resetting Customer Passwords ===\n');

        const newPassword = 'customer123';
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        const customers = await User.find({ role: 'customer' });

        for (const customer of customers) {
            customer.password = hashedPassword;
            await customer.save();
            console.log(`✅ Updated password for ${customer.fullName} (${customer.email})`);
        }

        console.log(`\n🔐 All customer passwords set to: ${newPassword}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}

resetCustomerPasswords();
