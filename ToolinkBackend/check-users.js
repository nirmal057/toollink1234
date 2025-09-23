import mongoose from 'mongoose';
import User from './src/models/User.js';

async function checkUsers() {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('Connected to database');

        const users = await User.find().select('email username role isActive');
        console.log('\nUsers in database:');
        console.log('='.repeat(40));

        if (users.length === 0) {
            console.log('No users found in database!');
        } else {
            users.forEach(user => {
                console.log(`- ${user.email || user.username} (${user.role}) - Active: ${user.isActive}`);
            });
        }

        console.log(`\nTotal users: ${users.length}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

checkUsers();
