const axios = require('axios');

async function testWarehouseFiltering() {
    try {
        console.log('🧪 Testing Warehouse-Specific Inventory Filtering...\n');

        // Test different warehouse users
        const testUsers = [
            { email: 'house1@toollink.com', password: '123456', expectedWarehouse: 'warehouse1', description: 'River Sand/Soil' },
            { email: 'house2@toollink.com', password: '123456', expectedWarehouse: 'warehouse2', description: 'Bricks' },
            { email: 'house3@toollink.com', password: '123456', expectedWarehouse: 'warehouse3', description: 'Metals' },
            { email: 'main_house@toollink.com', password: '123456', expectedWarehouse: 'main_warehouse', description: 'Tools & Equipment' }
        ];

        for (const user of testUsers) {
            console.log(`\n🏪 Testing ${user.description} (${user.email})...`);

            // Login
            const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
                email: user.email,
                password: user.password
            });

            if (!loginResponse.data.success) {
                console.error(`❌ Login failed for ${user.email}`);
                continue;
            }

            const token = loginResponse.data.accessToken;
            console.log(`✅ Login successful`);

            // Get inventory
            const inventoryResponse = await axios.get('http://localhost:5001/api/inventory', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (inventoryResponse.data.success) {
                const items = inventoryResponse.data.items || inventoryResponse.data.data.items || [];
                const warehouse = inventoryResponse.data.warehouse;

                console.log(`📦 Warehouse: ${warehouse}`);
                console.log(`📊 Items found: ${items.length}`);

                if (items.length > 0) {
                    console.log('   Sample items:');
                    items.slice(0, 3).forEach(item => {
                        console.log(`     - ${item.name} (${item.category})`);
                    });
                }

                // Verify correct warehouse filtering
                if (warehouse === user.expectedWarehouse) {
                    console.log(`✅ Correct warehouse filtering applied`);
                } else {
                    console.log(`❌ Expected ${user.expectedWarehouse}, got ${warehouse}`);
                }
            } else {
                console.error(`❌ Failed to fetch inventory: ${inventoryResponse.data.error}`);
            }
        }

        // Test admin access (should see all)
        console.log(`\n👑 Testing Admin Access...`);

        // Note: We'll skip admin test for now since we need the admin password
        console.log(`ℹ️  Admin test skipped - would need admin password`);

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testWarehouseFiltering();
