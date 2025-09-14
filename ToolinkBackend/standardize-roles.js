import mongoose from 'mongoose';

const standardizeRoles = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Define role mappings
        const roleMappings = {
            'ADMIN': 'admin',
            'WAREHOUSE_MANAGER': 'warehouse',
            'CASHIER': 'cashier',
            'EDITOR': 'editor',
            'CUSTOMER': 'customer'
        };

        console.log('\n🔄 Standardizing roles to lowercase...');

        for (const [oldRole, newRole] of Object.entries(roleMappings)) {
            const result = await usersCollection.updateMany(
                { role: oldRole },
                { $set: { role: newRole } }
            );

            if (result.modifiedCount > 0) {
                console.log(`✅ Updated ${result.modifiedCount} users from '${oldRole}' to '${newRole}'`);
            }
        }

        // Check final role distribution
        console.log('\n📊 Final role distribution:');
        const roles = await usersCollection.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        roles.forEach(role => {
            console.log(`- ${role._id}: ${role.count} users`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Role standardization complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

standardizeRoles();
