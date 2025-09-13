import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const fixAdminPassword = async () => {
    try {
        console.log('🔗 Connecting to local MongoDB...');

        // Connect to local MongoDB
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });

        console.log('✅ Connected to local MongoDB');

        // Find admin user directly in the collection
        const usersCollection = mongoose.connection.db.collection('users');
        const adminUser = await usersCollection.findOne({
            email: 'admin@toollink.com'
        });

        if (adminUser) {
            console.log('👤 Found admin user:');
            console.log('- Email:', adminUser.email);
            console.log('- Role:', adminUser.role);
            console.log('- Password field exists:', !!adminUser.password);
            console.log('- Password value:', adminUser.password);

            // Hash a new password
            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash('admin123', saltRounds);

            console.log('🔄 Updating admin password...');

            // Update the admin user's password
            const updateResult = await usersCollection.updateOne(
                { email: 'admin@toollink.com' },
                {
                    $set: {
                        password: newPasswordHash,
                        updatedAt: new Date()
                    }
                }
            );

            console.log('✅ Password update result:', updateResult);

            // Verify the update
            const verifyAdmin = await usersCollection.findOne({
                email: 'admin@toollink.com'
            });

            if (verifyAdmin && verifyAdmin.password) {
                const passwordCheck = await bcrypt.compare('admin123', verifyAdmin.password);
                console.log('✅ Password verification after update:', passwordCheck ? 'SUCCESS' : 'FAILED');
                console.log('✅ New password hash length:', verifyAdmin.password.length);
                console.log('✅ Password starts with $2:', verifyAdmin.password.startsWith('$2'));
            }

        } else {
            console.log('❌ Admin user not found');
        }

        console.log('\\n🎉 Admin password fix complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

fixAdminPassword();
