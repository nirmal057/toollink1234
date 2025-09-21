// Update test customer password
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import User from './src/models/User.js';

config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolink';

async function updateTestCustomerPassword() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Hash the new password
        const hashedPassword = await bcrypt.hash('testpassword123', 10);

        // Update the test customer password
        const result = await User.findOneAndUpdate(
            { email: 'testcustomer@toollink.com' },
            {
                password: hashedPassword,
                isActive: true,
                isApproved: true,
                emailVerified: true
            },
            { new: true }
        );

        if (result) {
            console.log('✅ Test customer password updated successfully!');
            console.log('Email:', result.email);
            console.log('Password: testpassword123');
            console.log('Active:', result.isActive);
            console.log('Approved:', result.isApproved);
        } else {
            console.log('❌ Test customer not found');
        }

    } catch (error) {
        console.error('❌ Error updating test customer:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

updateTestCustomerPassword();
