const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/toollink')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection failed:', err));

async function resetCustomerPasswords() {
    try {
        console.log('=== Resetting Customer Passwords ===\n');

        const newPassword = 'customer123';
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update passwords directly without triggering validation
        const result = await mongoose.connection.db.collection('users').updateMany(
            { role: 'customer' },
            { $set: { password: hashedPassword } }
        );

        console.log(`✅ Updated ${result.modifiedCount} customer passwords`);
        console.log(`🔐 All customer passwords set to: ${newPassword}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}

resetCustomerPasswords();
