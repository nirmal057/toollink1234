import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/toollink');

console.log('👤 Creating test customer...');

// Create User schema
const userSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    password: String,
    role: String,
    phone: String,
    address: String,
    isActive: Boolean
});

const User = mongoose.model('User', userSchema, 'users');

try {
    // Check if customer already exists
    const existingCustomer = await User.findOne({ email: 'iit21063@std.uwu.ac.lk' });

    if (existingCustomer) {
        console.log('✅ Customer already exists:', existingCustomer.fullName);
    } else {
        // Create customer
        const hashedPassword = await bcrypt.hash('123456', 10);

        const newCustomer = new User({
            fullName: 'Test Customer IIT',
            email: 'iit21063@std.uwu.ac.lk',
            password: hashedPassword,
            role: 'customer',
            phone: '+94712345678',
            address: '123 Test Street, Colombo',
            isActive: true
        });

        await newCustomer.save();
        console.log('✅ Customer created successfully!');
        console.log('Name:', newCustomer.fullName);
        console.log('Email:', newCustomer.email);
        console.log('Role:', newCustomer.role);
    }

} catch (error) {
    console.error('❌ Error creating customer:', error);
} finally {
    await mongoose.disconnect();
    console.log('📡 Database connection closed');
}
