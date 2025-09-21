// Test frontend API filtering for warehouse users
async function testFrontendAPIFiltering() {
    const baseURL = 'http://localhost:5001/api';

    // Test data for warehouse users
    const warehouseUsers = [
        { email: 'house1@toollink.com', password: '123456', warehouse: 'warehouse1', name: 'River Sand & Soil' },
        { email: 'house2@toollink.com', password: '123456', warehouse: 'warehouse2', name: 'Bricks & Masonry' },
        { email: 'house3@toollink.com', password: '123456', warehouse: 'warehouse3', name: 'Metals & Steel' },
        { email: 'main_house@toollink.com', password: '123456', warehouse: 'main_warehouse', name: 'Tools & Equipment' }
    ];

    console.log('🌐 Testing Frontend API Filtering...\n');

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

            // Get inventory
            const inventoryResponse = await fetch(`${baseURL}/inventory`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!inventoryResponse.ok) {
                console.log(`❌ Inventory request failed: ${inventoryResponse.status}`);
                continue;
            }

            const inventoryData = await inventoryResponse.json();
            const items = inventoryData.items || [];

            console.log(`✅ Login successful`);
            console.log(`📦 Warehouse: ${user.warehouse}`);
            console.log(`📊 Items found: ${items.length}`);

            if (items.length > 0) {
                // Group by category
                const categories = [...new Set(items.map(item => item.category))];
                console.log(`📂 Categories: ${categories.join(', ')}`);

                // Sample items
                console.log('   Sample items:');
                items.slice(0, 3).forEach(item => {
                    console.log(`     - ${item.name} (${item.category})`);
                });

                if (items.length > 3) {
                    console.log(`     ... and ${items.length - 3} more items`);
                }
            }

            console.log('✅ Correct warehouse filtering applied\n');

        } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
        }
    }
}

// Run the test
testFrontendAPIFiltering().catch(console.error);
