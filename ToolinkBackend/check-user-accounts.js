import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkUserAccounts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        const users = await User.find({}).select('email fullName role isActive isApproved password createdAt');

        console.log('\n📋 USER ACCOUNTS STATUS:');
        console.log('='.repeat(80));

        users.forEach((user, index) => {
            console.log(`\n${index + 1}. ${user.fullName || 'No Name'}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
            console.log(`   Approved: ${user.isApproved ? '✅' : '❌'}`);
            console.log(`   Has Password: ${user.password ? '✅' : '❌'}`);
            console.log(`   Created: ${user.createdAt?.toLocaleDateString() || 'Unknown'}`);

            if (!user.isApproved || !user.isActive) {
                console.log(`   ⚠️  LOGIN BLOCKED: ${!user.isApproved ? 'Not Approved' : 'Not Active'}`);
            } else {
                console.log(`   ✅ LOGIN ALLOWED`);
            }
        });

        console.log(`\n📊 SUMMARY:`);
        console.log(`Total users: ${users.length}`);
        console.log(`Active users: ${users.filter(u => u.isActive).length}`);
        console.log(`Approved users: ${users.filter(u => u.isApproved).length}`);
        console.log(`Users who can login: ${users.filter(u => u.isActive && u.isApproved).length}`);

        const unapprovedUsers = users.filter(u => !u.isApproved);
        if (unapprovedUsers.length > 0) {
            console.log(`\n❌ UNAPPROVED USERS (cannot login):`);
            unapprovedUsers.forEach(user => {
                console.log(`   - ${user.email} (${user.fullName || 'No Name'}) - ${user.role}`);
            });
        }

    } catch (error) {
        console.error('❌ Error checking user accounts:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

checkUserAccounts();
