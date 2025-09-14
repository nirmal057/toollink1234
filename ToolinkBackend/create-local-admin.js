import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const createLocalAdmin = async () => {
    try {
        console.log('🔗 Connecting to local MongoDB...');

        // Connect to local MongoDB
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });

        console.log('✅ Connected to local MongoDB (toollink database)');

        // Check existing users
        const usersCollection = mongoose.connection.db.collection('users');
        const existingUsers = await usersCollection.countDocuments();
        console.log(`📊 Existing users in database: ${existingUsers}`);

        // Check if admin already exists
        const existingAdmin = await usersCollection.findOne({
            email: 'admin@toollink.com'
        });

        if (existingAdmin) {
            console.log('✅ Admin user already exists');
            console.log('- Email:', existingAdmin.email);
            console.log('- Role:', existingAdmin.role);
            console.log('- Password hash exists:', !!existingAdmin.password);
            
            // Fix role case if needed
            if (existingAdmin.role === 'ADMIN') {
                console.log('🔄 Fixing admin role case (ADMIN -> admin)...');
                await usersCollection.updateOne(
                    { email: 'admin@toollink.com' },
                    { $set: { role: 'admin' } }
                );
                console.log('✅ Admin role updated to lowercase');
            }
        } else {
            console.log('🔄 Creating admin user...');

            // Hash the password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);

            // Create admin user
            const adminUser = {
                username: 'admin',
                email: 'admin@toollink.com',
                password: hashedPassword,
                fullName: 'System Administrator',
                role: 'admin',
                isActive: true,
                isApproved: true,
                emailVerified: true,
                phone: '+1-555-0000',
                address: {
                    street: '123 Admin Street',
                    city: 'Admin City',
                    state: 'Admin State',
                    zipCode: '12345',
                    country: 'USA'
                },
                preferences: {
                    theme: 'light',
                    notifications: {
                        email: true,
                        sms: false,
                        push: true
                    },
                    language: 'en'
                },
                refreshTokens: [],
                loginAttempts: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Insert the user
            const result = await usersCollection.insertOne(adminUser);
            console.log('✅ Admin user created successfully');
            console.log('- ID:', result.insertedId);
            console.log('- Email: admin@toollink.com');
            console.log('- Password: admin123');
            console.log('- Role: ADMIN');
        }

        // Verify the user can be found and password verified
        console.log('\\n🔍 Verifying admin user...');
        const verifyAdmin = await usersCollection.findOne({
            email: 'admin@toollink.com'
        });

        if (verifyAdmin && verifyAdmin.password) {
            const passwordCheck = await bcrypt.compare('admin123', verifyAdmin.password);
            console.log('✅ Password verification:', passwordCheck ? 'SUCCESS' : 'FAILED');
        }

        console.log('\\n🎉 Local admin setup complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createLocalAdmin();
