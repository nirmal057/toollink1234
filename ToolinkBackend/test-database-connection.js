import mongoose from 'mongoose';

const testDatabaseConnection = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        
        // Connect to local MongoDB
        await mongoose.connect('mongodb://localhost:27017/toollink', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        
        console.log('✅ Connected to MongoDB successfully!');
        
        // Get database instance
        const db = mongoose.connection.db;
        
        // List all collections
        console.log('\n📊 Database Collections:');
        const collections = await db.listCollections().toArray();
        collections.forEach((collection, index) => {
            console.log(`${index + 1}. ${collection.name}`);
        });
        
        // Check users collection
        console.log('\n👥 Users Collection Data:');
        const usersCollection = db.collection('users');
        const userCount = await usersCollection.countDocuments();
        console.log(`Total users: ${userCount}`);
        
        // Get a few sample users
        const sampleUsers = await usersCollection.find({}).limit(5).toArray();
        console.log('\nSample users:');
        sampleUsers.forEach((user, index) => {
            console.log(`${index + 1}. Email: ${user.email}, Role: ${user.role}, Active: ${user.isActive}`);
        });
        
        // Check admin user specifically
        console.log('\n🔑 Admin User Check:');
        const adminUser = await usersCollection.findOne({ email: 'admin@toollink.com' });
        if (adminUser) {
            console.log('✅ Admin user found:');
            console.log(`- Email: ${adminUser.email}`);
            console.log(`- Role: ${adminUser.role}`);
            console.log(`- Active: ${adminUser.isActive}`);
            console.log(`- Approved: ${adminUser.isApproved}`);
            console.log(`- Created: ${adminUser.createdAt}`);
        } else {
            console.log('❌ Admin user not found');
        }
        
        // Check inventory collection if it exists
        if (collections.find(c => c.name === 'inventory')) {
            console.log('\n📦 Inventory Collection:');
            const inventoryCollection = db.collection('inventory');
            const inventoryCount = await inventoryCollection.countDocuments();
            console.log(`Total inventory items: ${inventoryCount}`);
            
            const sampleInventory = await inventoryCollection.find({}).limit(3).toArray();
            sampleInventory.forEach((item, index) => {
                console.log(`${index + 1}. Name: ${item.name || item.itemName}, Stock: ${item.stock || item.quantity}`);
            });
        }
        
        // Check orders collection if it exists
        if (collections.find(c => c.name === 'orders')) {
            console.log('\n📋 Orders Collection:');
            const ordersCollection = db.collection('orders');
            const orderCount = await ordersCollection.countDocuments();
            console.log(`Total orders: ${orderCount}`);
            
            const sampleOrders = await ordersCollection.find({}).limit(3).toArray();
            sampleOrders.forEach((order, index) => {
                console.log(`${index + 1}. Order ID: ${order._id}, Status: ${order.status}, Total: ${order.total || 'N/A'}`);
            });
        }
        
        console.log('\n✅ Database test completed successfully!');
        
    } catch (error) {
        console.error('❌ Database connection error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

// Run the test
testDatabaseConnection().catch(console.error);