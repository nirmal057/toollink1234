import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost:27017';
const dbName = 'toollink';

async function connectAndGetData() {
    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB localhost:27017...');
        await client.connect();
        console.log('✅ Connected successfully!');

        const db = client.db(dbName);

        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📊 Available Collections:');
        collections.forEach((col, index) => {
            console.log(`${index + 1}. ${col.name}`);
        });

        // Check users collection
        console.log('\n👥 Users in database:');
        const users = await db.collection('users').find({}).toArray();

        if (users.length === 0) {
            console.log('❌ No users found in the database!');
        } else {
            console.log(`📋 Found ${users.length} users:`);
            users.forEach((user, index) => {
                console.log(`${index + 1}. Username: ${user.username || user.fullName || 'N/A'}`);
                console.log(`   Email: ${user.email || 'N/A'}`);
                console.log(`   Role: ${user.role || 'N/A'}`);
                console.log(`   Active: ${user.isActive !== undefined ? user.isActive : 'N/A'}`);
                console.log(`   Password Hash: ${user.password || user.passwordHash ? 'SET' : 'NOT SET'}`);
                console.log('   ---');
            });
        }

        // Check other important collections
        const warehouses = await db.collection('warehouses').find({}).toArray();
        console.log(`\n🏪 Warehouses: ${warehouses.length} found`);

        const materials = await db.collection('materials').find({}).toArray();
        console.log(`📦 Materials: ${materials.length} found`);

        const orders = await db.collection('mainorders').find({}).toArray();
        console.log(`📋 Main Orders: ${orders.length} found`);

        // Database stats
        const stats = await db.stats();
        console.log(`\n📊 Database Stats:`);
        console.log(`   Collections: ${stats.collections}`);
        console.log(`   Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Storage Size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

connectAndGetData();
