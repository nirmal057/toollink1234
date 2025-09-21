// Test warehouse-specific stats endpoint
async function testWarehouseStats() {
    const baseURL = 'http://localhost:5001/api';

    // Test data for warehouse users
    const warehouseUsers = [
        { email: 'house1@toollink.com', password: '123456', name: 'River Sand & Soil' },
        { email: 'house2@toollink.com', password: '123456', name: 'Bricks & Masonry' },
        { email: 'house3@toollink.com', password: '123456', name: 'Metals & Steel' },
        { email: 'main_house@toollink.com', password: '123456', name: 'Tools & Equipment' }
    ];

    console.log('📊 Testing Warehouse-Specific Stats Endpoint...\n');

    for (const user of warehouseUsers) {
        console.log(`🏪 Testing ${user.name} (${user.email})...`);

        try {
            // Login
            const loginResponse = await fetch(`${baseURL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    password: user.password
                })
            });

            if (!loginResponse.ok) {
                console.log(`❌ Login failed: ${loginResponse.status}`);
                continue;
            }

            const loginData = await loginResponse.json();
            const token = loginData.accessToken;

            // Get stats
            const statsResponse = await fetch(`${baseURL}/inventory/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!statsResponse.ok) {
                console.log(`❌ Stats request failed: ${statsResponse.status}`);
                continue;
            }

            const statsData = await statsResponse.json();

            console.log(`✅ Login successful`);
            console.log(`📊 Stats Data:`);
            console.log(`   Total Items: ${statsData.data.totalItems}`);
            console.log(`   Active Items: ${statsData.data.activeItems}`);
            console.log(`   Categories: ${statsData.data.categories}`);

            if (statsData.data.categoryDistribution && statsData.data.categoryDistribution.length > 0) {
                console.log(`   Category Distribution:`);
                statsData.data.categoryDistribution.forEach(cat => {
                    console.log(`     - ${cat._id}: ${cat.count} items`);
                });
            } else {
                console.log(`   No category distribution data`);
            }

            console.log('✅ Warehouse-specific stats working correctly\n');

        } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
        }
    }
}

// Run the test
testWarehouseStats().catch(console.error);
