import mongoose from 'mongoose';

const connectDirectly = async () => {
    try {
        console.log('Attempting direct connection to local MongoDB...');

        // Try local connection first
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });

        console.log('✅ Connected to local MongoDB');

        // Check if the users collection exists
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));

        // Check admin user directly
        const usersCollection = mongoose.connection.db.collection('users');
        const adminUser = await usersCollection.findOne({
            email: 'admin@toollink.com'
        });

        if (adminUser) {
            console.log('Admin user found:');
            console.log('- Email:', adminUser.email);
            console.log('- Role:', adminUser.role);
            console.log('- Password hash exists:', !!adminUser.password);
            if (adminUser.password) {
                console.log('- Password hash starts with $2:', adminUser.password.startsWith('$2'));
            }
        } else {
            console.log('❌ Admin user not found');

            // Check if there are any users
            const userCount = await usersCollection.countDocuments();
            console.log('Total users in database:', userCount);

            if (userCount > 0) {
                const sampleUsers = await usersCollection.find({}).limit(3).toArray();
                console.log('Sample users:', sampleUsers.map(u => ({ email: u.email, role: u.role })));
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
};

connectDirectly();
