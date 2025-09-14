import mongoose from 'mongoose';

const fixAdminRole = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const result = await db.collection('users').updateMany(
            { role: 'admin' },
            { $set: { role: 'ADMIN' } }
        );

        console.log('✅ Updated', result.modifiedCount, 'admin users to ADMIN role');

        // Also check for other lowercase roles and fix them
        const otherUpdates = await db.collection('users').updateMany(
            { role: { $in: ['warehouse', 'cashier', 'editor', 'customer', 'driver', 'user'] } },
            [{ $set: { role: { $toUpper: '$role' } } }]
        );

        console.log('✅ Updated', otherUpdates.modifiedCount, 'other users to uppercase roles');

        await mongoose.disconnect();
        console.log('✅ Database update complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

fixAdminRole();
