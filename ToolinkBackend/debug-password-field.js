// Debug script to check if password field is being loaded
import mongoose from 'mongoose';
import { config } from 'dotenv';
import User from './src/models/User.js';

config();

async function debugPasswordField() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Finding admin user...');
        const user = await User.findByEmailOrUsername('admin@toollink.com');

        if (!user) {
            console.log('❌ Admin user not found');
            return;
        }

        console.log('✅ Admin user found:');
        console.log('- Email:', user.email);
        console.log('- Role:', user.role);
        console.log('- Has password field:', !!user.password);
        console.log('- Password length:', user.password?.length);
        console.log('- Password (first 20 chars):', user.password?.substring(0, 20));

        // Try to manually select password
        console.log('\n🔍 Trying manual password selection...');
        const userWithPassword = await User.findOne({ email: 'admin@toollink.com' }).select('+password');
        console.log('- Manual select - Has password:', !!userWithPassword.password);
        console.log('- Manual select - Password length:', userWithPassword.password?.length);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugPasswordField();
