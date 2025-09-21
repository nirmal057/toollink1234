// Approve test customer for testing
import mongoose from 'mongoose';
import { config } from 'dotenv';
import User from './src/models/User.js';

config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink';

async function approveTestCustomer() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find and approve the test customer
        const result = await User.findOneAndUpdate(
            { email: 'testcustomer@toollink.com' },
            {
                isActive: true,
                isApproved: true,
                emailVerified: true,
                approvedBy: new mongoose.Types.ObjectId('6883239bc1f0c1ffb8f0bf17'), // Admin ID
                approvedAt: new Date()
            },
            { new: true }
        );

        if (result) {
            console.log('✅ Test customer approved successfully!');
            console.log('Email:', result.email);
            console.log('Active:', result.isActive);
            console.log('Approved:', result.isApproved);
            console.log('Email Verified:', result.emailVerified);
        } else {
            console.log('❌ Test customer not found');
        }

    } catch (error) {
        console.error('❌ Error approving test customer:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

approveTestCustomer();
