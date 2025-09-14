import mongoose from './ToolinkBackend/node_modules/mongoose/index.js';
import User from './ToolinkBackend/src/models/User.js';
import Delivery from './ToolinkBackend/src/models/Delivery.js';

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
            console.log('💡 You need to add some drivers first');
        } else {
            drivers.forEach((driver, index) => {
                console.log(`\n${index + 1}. Driver: ${driver.fullName || 'No name'}`);
                console.log(`   📧 Email: ${driver.email}`);
                console.log(`   📱 Phone: ${driver.phone || 'No phone'}`);
                console.log(`   🆔 License: ${driver.licenseNumber || 'No license'}`);
                console.log(`   🚛 Vehicle: ${driver.vehicleType || 'No vehicle type'}`);
                console.log(`   📅 Created: ${driver.createdAt?.toLocaleDateString() || 'Unknown'}`);
                console.log(`   ✅ Active: ${driver.isActive ? 'Yes' : 'No'}`);
            });
        }

        // Check deliveries collection
        console.log('\n🚚 Checking deliveries in database...');
        const deliveries = await Delivery.find({})
            .populate('driverId', 'fullName email')
            .populate('orderId', 'orderNumber')
            .sort({ createdAt: -1 })
            .limit(10);

        console.log(`📦 Found ${deliveries.length} deliveries in database`);

        if (deliveries.length === 0) {
            console.log('❌ No deliveries found in database');
            console.log('💡 You need to create some orders and deliveries first');
        } else {
            deliveries.forEach((delivery, index) => {
                console.log(`\n${index + 1}. Delivery ID: ${delivery._id}`);
                console.log(`   📋 Order: ${delivery.orderId?.orderNumber || 'No order'}`);
                console.log(`   👤 Driver: ${delivery.driverId?.fullName || 'Unassigned'}`);
                console.log(`   📍 Address: ${delivery.deliveryAddress || 'No address'}`);
                console.log(`   📊 Status: ${delivery.status}`);
                console.log(`   📅 Created: ${delivery.createdAt?.toLocaleDateString() || 'Unknown'}`);
            });
        }

        // Test the drivers API endpoint
        console.log('\n🧪 Testing drivers API endpoint...');
        try {
            const response = await fetch('http://localhost:5001/api/drivers', {
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODgzMjM5YmMxZjBjMWZmYjhmMGJmMTciLCJpYXQiOjE3NTc4MzU0NzIsImV4cCI6MTc1NzgzOTA3Mn0.7kksmqMI7yYepAD1sgVnRWTXZgRRNB_V_1syl648jaE`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API Response:', JSON.stringify(data, null, 2));
            } else {
                console.log(`❌ API Error: ${response.status} ${response.statusText}`);
                const errorData = await response.text();
                console.log('Error details:', errorData);
            }
        } catch (apiError) {
            console.error('❌ API Test failed:', apiError.message);
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
