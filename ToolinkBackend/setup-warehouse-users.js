import mongoose from 'mongoose';
import User from './src/models/User.js';
import bcrypt from 'bcrypt';

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ MongoDB connected for warehouse user setup');
        return true;
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        return false;
    }
};

const setupWarehouseUsers = async () => {
    console.log('🏭 Setting up warehouse user accounts...');

    if (!await connectDB()) {
        return;
    }

    try {
        // Define warehouse users
        const warehouseUsers = [
            {
                email: 'house1@toollink.com',
                username: 'warehouse1',
                password: 'warehouse123',
                fullName: 'W1 Warehouse Manager',
                warehouseCode: 'W1',
                role: 'warehouse_manager'
            },
            {
                email: 'house2@toollink.com',
                username: 'warehouse2',
                password: 'warehouse123',
                fullName: 'W2 Warehouse Manager',
                warehouseCode: 'W2',
                role: 'warehouse_manager'
            },
            {
                email: 'house3@toollink.com',
                username: 'warehouse3',
                password: 'warehouse123',
                fullName: 'W3 Warehouse Manager',
                warehouseCode: 'W3',
                role: 'warehouse_manager'
            },
            {
                email: 'main_house@toollink.com',
                username: 'main_warehouse',
                password: 'warehouse123',
                fullName: 'Main Warehouse Manager',
                warehouseCode: 'WM',
                role: 'warehouse_manager'
            }
        ];

        let created = 0;
        let updated = 0;

        for (const userData of warehouseUsers) {
            console.log(`\n📦 Processing user: ${userData.email}`);

            // Check if user exists
            const existingUser = await User.findOne({ email: userData.email });

            if (existingUser) {
                console.log(`  ℹ️  User exists, updating warehouse code...`);

                // Update warehouse code if missing
                const updateData = {};
                if (!existingUser.warehouseCode) {
                    updateData.warehouseCode = userData.warehouseCode;
                }
                if (!existingUser.role || existingUser.role === 'customer') {
                    updateData.role = userData.role;
                }

                if (Object.keys(updateData).length > 0) {
                    await User.updateOne({ _id: existingUser._id }, { $set: updateData });
                    console.log(`  ✅ Updated with:`, updateData);
                    updated++;
                } else {
                    console.log(`  ✅ User already has correct warehouse settings`);
                }
            } else {
                console.log(`  📝 Creating new warehouse user...`);

                try {
                    // Hash password
                    const hashedPassword = await bcrypt.hash(userData.password, 12);

                    const newUser = new User({
                        email: userData.email,
                        username: userData.username,
                        password: hashedPassword,
                        fullName: userData.fullName,
                        warehouseCode: userData.warehouseCode,
                        role: userData.role,
                        isEmailVerified: true, // Auto-verify warehouse users
                        status: 'active'
                    });

                    await newUser.save();
                    console.log(`  ✅ Created user: ${userData.fullName} (${userData.warehouseCode})`);
                    created++;

                } catch (createError) {
                    console.error(`  ❌ Failed to create user: ${createError.message}`);
                }
            }
        }

        // Verify final state
        const warehouseUsersList = await User.find({
            warehouseCode: { $in: ['W1', 'W2', 'W3', 'WM'] }
        }).select('email warehouseCode role fullName');

        console.log('\n📊 WAREHOUSE USERS SUMMARY:');
        console.log(`Users created: ${created}`);
        console.log(`Users updated: ${updated}`);
        console.log('\nWarehouse users in database:');

        warehouseUsersList.forEach(user => {
            console.log(`  - ${user.email} → ${user.warehouseCode} (${user.role})`);
        });

        // Show login credentials
        console.log('\n🔑 LOGIN CREDENTIALS FOR TESTING:');
        warehouseUsers.forEach(userData => {
            console.log(`${userData.warehouseCode}: ${userData.email} / ${userData.password}`);
        });

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Run the setup
setupWarehouseUsers().then(() => {
    console.log('🎉 Warehouse users setup completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Warehouse users setup failed:', error);
    process.exit(1);
});
