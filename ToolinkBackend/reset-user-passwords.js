import mongoose from 'mongoose';
import User from './src/models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function resetUserPasswords() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        // Standard password for all users (can be customized)
        const standardPassword = '123456';
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(standardPassword, saltRounds);

        console.log(`🔐 Setting standard password: "${standardPassword}" for all users`);
        console.log('='.repeat(60));

        const users = await User.find({});

        for (const user of users) {
            // Skip admin if it already works
            if (user.email === 'admin@toollink.com') {
                console.log(`⏭️  Skipping admin user: ${user.email}`);
                continue;
            }

            await User.findByIdAndUpdate(user._id, {
                password: hashedPassword,
                isApproved: true,
                isActive: true,
                isLocked: false
            });

            console.log(`✅ Updated password for: ${user.email} (${user.fullName}) - ${user.role}`);
        }

        console.log('\n🎉 All user passwords reset successfully!');
        console.log(`📋 Users can now login with email and password: "${standardPassword}"`);

        // Verify a few logins
        console.log('\n🧪 Verifying logins...');
        const testUsers = ['iit21026@std.uwu.ac.lk', 'hte21044@std.uwu.ac.lk', 'chathursha@gmail.com'];

        for (const email of testUsers) {
            const user = await User.findByEmailOrUsername(email);
            if (user) {
                const isMatch = await user.comparePassword(standardPassword);
                console.log(`   ${email}: ${isMatch ? '✅' : '❌'}`);
            }
        }

    } catch (error) {
        console.error('❌ Error resetting passwords:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

resetUserPasswords();
