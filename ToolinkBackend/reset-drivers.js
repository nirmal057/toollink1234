import mongoose from 'mongoose';
import User from './src/models/User.js';

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect('mongodb://localhost:27017/toollink');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function resetDrivers() {
    await connectDB();
    
    try {
        console.log('🗑️ Removing existing drivers...');
        await User.deleteMany({ role: 'driver' });
        console.log('✅ Existing drivers removed');
        
        console.log('➕ Creating new sample drivers...');
        
        // Create driver 1
        const driver1 = new User({
            username: 'driver1',
            email: 'driver1@toollink.com',
            password: 'driver123',
            fullName: 'John Driver',
            phone: '+94777123456',
            role: 'driver',
            licenseNumber: 'D123456789',
            vehicleInfo: {
                type: 'Truck',
                plateNumber: 'WP-CAR-1234',
                capacity: '2 tons'
            },
            rating: 4.8,
            isApproved: true,
            isActive: true,
            emailVerified: true
        });
        
        await driver1.save();
        console.log('✅ Driver 1 created: John Driver');
        
        // Create driver 2
        const driver2 = new User({
            username: 'driver2',
            email: 'driver2@toollink.com',
            password: 'driver123',
            fullName: 'Jane Smith',
            phone: '+94777987654',
            role: 'driver',
            licenseNumber: 'D987654321',
            vehicleInfo: {
                type: 'Van',
                plateNumber: 'WP-VAN-5678',
                capacity: '1 ton'
            },
            rating: 4.5,
            isApproved: true,
            isActive: true,
            emailVerified: true
        });
        
        await driver2.save();
        console.log('✅ Driver 2 created: Jane Smith');
        
        // Create driver 3
        const driver3 = new User({
            username: 'driver3',
            email: 'driver3@toollink.com',
            password: 'driver123',
            fullName: 'Mike Wilson',
            phone: '+94777555123',
            role: 'driver',
            licenseNumber: 'D555123789',
            vehicleInfo: {
                type: 'Motorcycle',
                plateNumber: 'WP-BIKE-9999',
                capacity: '50 kg'
            },
            rating: 4.9,
            isApproved: true,
            isActive: true,
            emailVerified: true
        });
        
        await driver3.save();
        console.log('✅ Driver 3 created: Mike Wilson');
        
        // Verify creation
        const allDrivers = await User.find({ role: 'driver' }).select('-password');
        console.log(`\n📊 Total drivers created: ${allDrivers.length}`);
        
        allDrivers.forEach((driver, index) => {
            console.log(`\n${index + 1}. ${driver.fullName}`);
            console.log(`   📧 Email: ${driver.email}`);
            console.log(`   📱 Phone: ${driver.phone}`);
            console.log(`   🆔 License: ${driver.licenseNumber}`);
            console.log(`   🚛 Vehicle: ${driver.vehicleInfo?.type}`);
            console.log(`   🔢 Plate: ${driver.vehicleInfo?.plateNumber}`);
            console.log(`   ⚖️ Capacity: ${driver.vehicleInfo?.capacity}`);
            console.log(`   ⭐ Rating: ${driver.rating}/5`);
        });
        
    } catch (error) {
        console.error('❌ Error resetting drivers:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Database connection closed');
    }
}

// Run the reset
resetDrivers();