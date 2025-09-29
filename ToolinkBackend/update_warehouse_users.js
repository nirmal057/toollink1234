import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function updateWarehouseUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/toollink');
        console.log('✅ Connected to MongoDB');

        // Email to warehouse code mapping
        const emailToWarehouseCode = {
            'house1@toollink.com': 'W1',       // Sand & Aggregates
            'house2@toollink.com': 'W2',       // Blocks & Masonry
            'house3@toollink.com': 'W3',       // Steel & Metal
            'main_house@toollink.com': 'WM'    // Tools & Equipment
        };

        console.log('\n=== UPDATING WAREHOUSE USERS WITH WAREHOUSE CODES ===');

        for (const [email, warehouseCode] of Object.entries(emailToWarehouseCode)) {
            const user = await User.findOne({ email: email });

            if (user) {
                // Update the user with warehouse code
                user.warehouseCode = warehouseCode;
                user.role = 'warehouse'; // Ensure role is set correctly
                await user.save();

                console.log(`✅ Updated ${email} → ${warehouseCode}`);
                console.log(`   User: ${user.fullName || user.username}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Warehouse Code: ${user.warehouseCode}`);
                console.log('');
            } else {
                console.log(`❌ User not found: ${email}`);

                // Create the user if it doesn't exist
                const newUser = new User({
                    username: email.split('@')[0],
                    email: email,
                    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeESQ5bg0RA9JHKxG', // 123456 hashed
                    fullName: `${warehouseCode} Warehouse Manager`,
                    role: 'warehouse',
                    warehouseCode: warehouseCode,
                    isActive: true,
                    isApproved: true,
                    emailVerified: true
                });

                await newUser.save();
                console.log(`✅ Created new user: ${email} → ${warehouseCode}`);
                console.log('');
            }
        }

        console.log('\n=== VERIFICATION ===');
        const warehouseUsers = await User.find({
            role: 'warehouse',
            email: { $in: Object.keys(emailToWarehouseCode) }
        }).select('email username fullName role warehouseCode');

        console.log(`Found ${warehouseUsers.length} warehouse users:`);
        warehouseUsers.forEach(user => {
            console.log(`📧 ${user.email} → 🏭 ${user.warehouseCode} (${user.fullName})`);
        });

        console.log('\n🎉 WAREHOUSE USER UPDATE COMPLETE!');
        console.log('All warehouse users now have proper warehouse codes assigned.');

    } catch (error) {
        console.error('❌ Error updating warehouse users:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

updateWarehouseUsers();
