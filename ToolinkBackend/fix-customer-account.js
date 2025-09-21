// Check and fix customer account for iit21026
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import User from './src/models/User.js';

config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink';

async function fixCustomerAccount() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find the customer
        const customer = await User.findOne({ email: 'iit21026@std.uwu.ac.lk' });

        if (!customer) {
            console.log('❌ Customer not found');
            return;
        }

        console.log('📊 Current customer status:');
        console.log('   Email:', customer.email);
        console.log('   Username:', customer.username);
        console.log('   Role:', customer.role);
        console.log('   Active:', customer.isActive);
        console.log('   Approved:', customer.isApproved);
        console.log('   Email Verified:', customer.emailVerified);

        // Hash a new password
        const newPassword = 'iit21026'; // Use username as password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the customer to ensure they can login
        const result = await User.findByIdAndUpdate(customer._id, {
            password: hashedPassword,
            isActive: true,
            isApproved: true,
            emailVerified: true
        }, { new: true });

        console.log('\n✅ Customer account updated successfully!');
        console.log('   Email: iit21026@std.uwu.ac.lk');
        console.log('   Password: iit21026');
        console.log('   Active:', result.isActive);
        console.log('   Approved:', result.isApproved);
        console.log('   Email Verified:', result.emailVerified);

    } catch (error) {
        console.error('❌ Error fixing customer account:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

fixCustomerAccount();
