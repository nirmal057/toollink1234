import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import models
import User from './src/models/User.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/toolink';

console.log('🔍 Checking current users in database...');

async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function checkUsers() {
    try {
        // Get all users
        const allUsers = await User.find({}, {
            username: 1,
            email: 1,
            role: 1,
            fullName: 1,
            createdAt: 1
        }).sort({ createdAt: -1 });

        console.log(`\n📊 Total users in database: ${allUsers.length}`);

        if (allUsers.length === 0) {
            console.log('❌ No users found in database');
            return;
        }

        console.log('\n👥 All users:');
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.fullName || user.username} (${user.username})`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Created: ${user.createdAt || 'Unknown'}`);
            console.log('');
        });

        // Filter customers specifically
        const customers = allUsers.filter(user => user.role === 'customer');
        console.log(`\n🛒 Customer users: ${customers.length}`);

        if (customers.length > 0) {
            customers.forEach((customer, index) => {
                console.log(`${index + 1}. ${customer.fullName || customer.username} (${customer.username})`);
                console.log(`   Email: ${customer.email}`);
                console.log(`   ID: ${customer._id}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Error checking users:', error);
        throw error;
    }
}

async function main() {
    try {
        await connectDatabase();
        await checkUsers();
    } catch (error) {
        console.error('\n💥 Process failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the check
main();
