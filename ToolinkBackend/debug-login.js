import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const debugLogin = async () => {
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
            console.log('- Password field exists:', !!adminUser.password);
            console.log('- Password type:', typeof adminUser.password);
            console.log('- Password length:', adminUser.password ? adminUser.password.length : 'N/A');
            console.log('- Password value (first 20 chars):', adminUser.password ? adminUser.password.substring(0, 20) + '...' : 'N/A');

            console.log('\n🧪 Testing password comparison...');
            const testPassword = 'admin123';
            console.log('- Test password:', testPassword);
            console.log('- Test password type:', typeof testPassword);

            try {
                const result = await bcrypt.compare(testPassword, adminUser.password);
                console.log('✅ bcrypt.compare result:', result);
            } catch (bcryptError) {
                console.error('❌ bcrypt.compare error:', bcryptError.message);
                console.error('Full error:', bcryptError);
            }

        } else {
            console.log('❌ Admin user not found');
        }

        await mongoose.disconnect();
        console.log('\n🎉 Debug complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
};

debugLogin();
