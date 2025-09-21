import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function showLoginCredentials() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        const users = await User.find({}).select('email fullName role isActive isApproved').sort({ role: 1, email: 1 });

        console.log('\n🔑 WORKING LOGIN CREDENTIALS');
        console.log('='.repeat(80));
        console.log('All users can login with their email and password: "123456"');
        console.log('(Admin might have a different password)');
        console.log('='.repeat(80));

        const roleGroups = {};
        users.forEach(user => {
            if (!roleGroups[user.role]) {
                roleGroups[user.role] = [];
            }
            roleGroups[user.role].push(user);
        });

        Object.keys(roleGroups).sort().forEach(role => {
            console.log(`\n📋 ${role.toUpperCase()} USERS:`);
            roleGroups[role].forEach((user, index) => {
                const status = (user.isActive && user.isApproved) ? '✅' : '❌';
                console.log(`   ${index + 1}. ${user.email}`);
                console.log(`      Name: ${user.fullName}`);
                console.log(`      Password: ${role === 'admin' ? '[admin password]' : '123456'}`);
                console.log(`      Status: ${status} ${(user.isActive && user.isApproved) ? 'Can Login' : 'Cannot Login'}`);
                console.log('');
            });
        });

        console.log('💡 QUICK TEST:');
        console.log('Try logging in with:');
        console.log('   Customer: iit21026@std.uwu.ac.lk / 123456');
        console.log('   Customer: hte21044@std.uwu.ac.lk / 123456');
        console.log('   Warehouse: house1@gmail.com / 123456');
        console.log('   Driver: iit21003@gmail.com / 123456');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

showLoginCredentials();
