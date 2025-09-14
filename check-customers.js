import { MongoClient } from 'mongodb';

async function checkCustomers() {
    const client = new MongoClient('mongodb://localhost:27017');

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('toollink');
        const users = await db.collection('users').find({ role: 'customer' }).toArray();

        console.log(`Found ${users.length} customers:`);
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.fullName || user.name} (${user.email})`);
            console.log(`   Role: ${user.role}`);
            console.log(`   ID: ${user._id}`);
            console.log('');
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.close();
    }
}

checkCustomers();
