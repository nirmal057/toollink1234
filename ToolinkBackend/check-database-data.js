import mongoose from 'mongoose';

const checkDatabase = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // Check users collection
        console.log('\n👥 USERS COLLECTION:');
        const users = await db.collection('users').find({}).limit(5).toArray();
        console.log(`Total users: ${await db.collection('users').countDocuments()}`);
        users.forEach(user => {
            console.log(`- ${user.fullName} (${user.email}) - Role: ${user.role} - Active: ${user.isActive}`);
        });

        // Check inventory collection
        console.log('\n📦 INVENTORY COLLECTION:');
        const inventoryCount = await db.collection('inventories').countDocuments();
        console.log(`Total inventory items: ${inventoryCount}`);
        if (inventoryCount > 0) {
            const inventory = await db.collection('inventories').find({}).limit(3).toArray();
            inventory.forEach(item => {
                console.log(`- ${item.name} - Stock: ${item.quantity} - Price: $${item.price}`);
            });
        }

        // Check orders collection
        console.log('\n📋 ORDERS COLLECTION:');
        const ordersCount = await db.collection('orders').countDocuments();
        console.log(`Total orders: ${ordersCount}`);
        if (ordersCount > 0) {
            const orders = await db.collection('orders').find({}).limit(3).toArray();
            orders.forEach(order => {
                console.log(`- Order ${order._id} - Status: ${order.status} - Total: $${order.total}`);
            });
        }

        // Check other collections
        console.log('\n📊 OTHER COLLECTIONS:');
        const collections = await db.listCollections().toArray();
        for (const collection of collections) {
            const count = await db.collection(collection.name).countDocuments();
            console.log(`- ${collection.name}: ${count} documents`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Database check complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkDatabase();
