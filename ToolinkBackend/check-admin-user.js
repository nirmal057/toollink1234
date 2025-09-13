import mongoose from 'mongoose';
import User from './src/models/User.js';
import './src/config/database.js';

const checkAdminUser = async () => {
    try {
        console.log('Connecting to MongoDB...');

        // Find admin user
        const admin = await User.findOne({
            $or: [
                { email: 'admin@toollink.com' },
                { role: 'ADMIN' }
            ]
        }).select('+password'); // Include password field

        if (admin) {
            console.log('Admin user found:');
            console.log('- ID:', admin._id);
            console.log('- Email:', admin.email);
            console.log('- Username:', admin.username);
            console.log('- Role:', admin.role);
            console.log('- IsActive:', admin.isActive);
            console.log('- IsApproved:', admin.isApproved);
            console.log('- Password hash exists:', !!admin.password);
            console.log('- Password hash length:', admin.password ? admin.password.length : 'N/A');
            console.log('- Password starts with $2:', admin.password ? admin.password.startsWith('$2') : 'N/A');
        } else {
            console.log('No admin user found');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAdminUser();
