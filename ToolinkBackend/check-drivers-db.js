import mongoose from 'mongoose';
import User from './src/models/User.js';
import Delivery from './src/models/Delivery.js';

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

async function testDriverData() {
    await connectDB();
    
    try {
        console.log('🔍 Checking driver data in database...\n');
        
        // Get all users with driver role
        const drivers = await User.find({ role: 'driver' })
            .select('-password')
            .sort({ createdAt: -1 });
            
        console.log(`📊 Found ${drivers.length} drivers in database:`);
        
        if (drivers.length === 0) {
            console.log('❌ No drivers found in database');
            console.log('💡 Let me create a sample driver for testing...');
            
            // Create a sample driver
            const sampleDriver = new User({
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
                isApproved: true,
                isActive: true,
                emailVerified: true
            });
            
            await sampleDriver.save();
            console.log('✅ Sample driver created successfully!');
            
            // Also create one more
            const sampleDriver2 = new User({
                username: 'driver2',
                email: 'driver2@toollink.com',
                password: 'driver123',
                fullName: 'Jane Driver',
                phone: '+94777987654',
                role: 'driver',
                licenseNumber: 'D987654321',
                vehicleInfo: {
                    type: 'Van',
                    plateNumber: 'WP-VAN-5678',
                    capacity: '1 ton'
                },
                isApproved: true,
                isActive: true,
                emailVerified: true
            });
            
            await sampleDriver2.save();
            console.log('✅ Second sample driver created successfully!');
            
            // Now get the updated list
            const updatedDrivers = await User.find({ role: 'driver' })
                .select('-password')
                .sort({ createdAt: -1 });
                
            console.log(`\n📊 Now have ${updatedDrivers.length} drivers in database:`);
            updatedDrivers.forEach((driver, index) => {
                console.log(`\n${index + 1}. Driver: ${driver.fullName}`);
                console.log(`   📧 Email: ${driver.email}`);
                console.log(`   📱 Phone: ${driver.phone || 'No phone'}`);
                console.log(`   🆔 License: ${driver.licenseNumber || 'No license'}`);
                console.log(`   🚛 Vehicle: ${driver.vehicleInfo?.type || 'No vehicle type'}`);
                console.log(`   🔢 Plate: ${driver.vehicleInfo?.plateNumber || 'No plate'}`);
                console.log(`   ⚖️ Capacity: ${driver.vehicleInfo?.capacity || 'No capacity'}`);
                console.log(`   ✅ Active: ${driver.isActive ? 'Yes' : 'No'}`);
            });
        } else {
            drivers.forEach((driver, index) => {
                console.log(`\n${index + 1}. Driver: ${driver.fullName || 'No name'}`);
                console.log(`   📧 Email: ${driver.email}`);
                console.log(`   📱 Phone: ${driver.phone || 'No phone'}`);
                console.log(`   🆔 License: ${driver.licenseNumber || 'No license'}`);
                console.log(`   🚛 Vehicle: ${driver.vehicleInfo?.type || 'No vehicle type'}`);
                console.log(`   🔢 Plate: ${driver.vehicleInfo?.plateNumber || 'No plate'}`);
                console.log(`   ⚖️ Capacity: ${driver.vehicleInfo?.capacity || 'No capacity'}`);
                console.log(`   📅 Created: ${driver.createdAt?.toLocaleDateString() || 'Unknown'}`);
                console.log(`   ✅ Active: ${driver.isActive ? 'Yes' : 'No'}`);
            });
        }
        
        // Check deliveries collection
        console.log('\n🚚 Checking deliveries in database...');
        const deliveryCount = await Delivery.countDocuments({});
        console.log(`📦 Found ${deliveryCount} deliveries in database`);
        
        if (deliveryCount === 0) {
            console.log('❌ No deliveries found in database');
            console.log('💡 Note: Deliveries are usually created when orders are processed');
        }
        
    } catch (error) {
        console.error('❌ Error checking driver data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Database connection closed');
    }
}

// Run the test
testDriverData();