import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkWarehouseUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/toollink');
        console.log('=== CHECKING WAREHOUSE USERS ===');

        const warehouseUsers = await User.find({
            role: 'warehouse',
            email: { $in: ['house1@toollink.com', 'house2@toollink.com', 'house3@toollink.com', 'main_house@toollink.com'] }
        }).select('email username fullName role assignedWarehouses primaryWarehouse');

        console.log('Found', warehouseUsers.length, 'warehouse users:');
        warehouseUsers.forEach(user => {
            console.log('Email:', user.email);
            console.log('Username:', user.username || 'N/A');
            console.log('Role:', user.role);
            console.log('AssignedWarehouses:', user.assignedWarehouses || []);
            console.log('PrimaryWarehouse:', user.primaryWarehouse || 'N/A');
            console.log('---');
        });

        // Check if we need to add warehouseCode field
        console.log('\n=== CHECKING WAREHOUSE CODE ASSIGNMENTS ===');
        const emailToWarehouseCode = {
            'house1@toollink.com': 'W1',  // Sand & Aggregates
            'house2@toollink.com': 'W2',  // Blocks & Masonry
            'house3@toollink.com': 'W3',  // Steel & Metal
            'main_house@toollink.com': 'WM' // Tools & Equipment
        };

        for (const user of warehouseUsers) {
            const expectedCode = emailToWarehouseCode[user.email];
            console.log(`${user.email} should have warehouseCode: ${expectedCode}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkWarehouseUsers();
