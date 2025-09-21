import mongoose from 'mongoose';
import User from './src/models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function testUserLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        // Test a few different users
        const testUsers = [
            { email: 'iit21026@std.uwu.ac.lk', expectedName: 'lahiru' },
            { email: 'hte21044@std.uwu.ac.lk', expectedName: 'avishka' },
            { email: 'chathursha@gmail.com', expectedName: 'chathursha' },
            { email: 'house1@gmail.com', expectedName: 'house1' }
        ];

        for (const testUser of testUsers) {
            console.log(`\n🧪 Testing login for: ${testUser.email}`);
            console.log('='.repeat(50));

            const user = await User.findByEmailOrUsername(testUser.email);
            if (!user) {
                console.log('❌ User not found');
                continue;
            }

            console.log(`📝 User Details:`);
            console.log(`   Name: ${user.fullName}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Active: ${user.isActive}`);
            console.log(`   Approved: ${user.isApproved}`);
            console.log(`   Has Password Hash: ${!!user.password}`);

            // Test with their username as password (common pattern we've been using)
            const testPassword = testUser.expectedName;
            console.log(`\n🔐 Testing password: "${testPassword}"`);

            try {
                const isMatch = await user.comparePassword(testPassword);
                console.log(`   Password match: ${isMatch ? '✅' : '❌'}`);

                if (isMatch) {
                    console.log('✅ LOGIN SHOULD WORK');
                } else {
                    // Try with some common variations
                    const variations = [
                        testPassword + '123',
                        testPassword.toLowerCase(),
                        testPassword.toUpperCase(),
                        'password123',
                        '123456'
                    ];

                    console.log('   Trying password variations...');
                    for (const variation of variations) {
                        const varMatch = await user.comparePassword(variation);
                        if (varMatch) {
                            console.log(`   ✅ Password "${variation}" works!`);
                            break;
                        }
                    }
                }
            } catch (passwordError) {
                console.log(`   ❌ Password comparison error: ${passwordError.message}`);
            }

            // Check login blockers
            const blockers = [];
            if (!user.isActive) blockers.push('Not Active');
            if (!user.isApproved) blockers.push('Not Approved');
            if (user.isLocked) blockers.push('Account Locked');

            if (blockers.length > 0) {
                console.log(`❌ LOGIN BLOCKED: ${blockers.join(', ')}`);
            } else {
                console.log('✅ No account-level blockers');
            }
        }

    } catch (error) {
        console.error('❌ Error testing login:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

testUserLogin();
