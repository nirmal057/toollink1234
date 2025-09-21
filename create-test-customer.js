// Create Test Customer for Order Testing
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import User from './ToolinkBackend/src/models/User.js';

config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolink';

async function createTestCustomer() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if test customer already exists
        const existingUser = await User.findOne({ email: 'testcustomer@toollink.com' });

        if (existingUser) {
            console.log('✅ Test customer already exists');
            console.log('Email: testcustomer@toollink.com');
            console.log('Password: testpassword123');
            return;
        }

        // Create test customer
        const hashedPassword = await bcrypt.hash('testpassword123', 10);

        const testCustomer = new User({
            username: 'testcustomer',
            email: 'testcustomer@toollink.com',
            password: hashedPassword,
            fullName: 'Test Customer',
            role: 'customer',
            phoneNumber: '+94771234567',
            address: {
                street: '123 Test Street',
                city: 'Colombo',
                postalCode: '00100',
                district: 'Colombo'
            },
            isEmailVerified: true,
            accountStatus: 'active'
        });

        await testCustomer.save();

        console.log('✅ Test customer created successfully!');
        console.log('Email: testcustomer@toollink.com');
        console.log('Password: testpassword123');
        console.log('Role: customer');

    } catch (error) {
        console.error('❌ Error creating test customer:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

createTestCustomer();
