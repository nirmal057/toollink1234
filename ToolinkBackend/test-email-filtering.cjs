const fetch = require('node-fetch');

async function testEmailBasedFiltering() {
    console.log('=== TESTING EMAIL-BASED ORDER FILTERING ===\n');

    // Test for each customer
    const customers = [
        { email: 'chathursha@gmail.com', password: 'customer123', expectedOrders: 2 },
        { email: 'sakila@gmail.com', password: 'customer123', expectedOrders: 2 },
        { email: 'chanuth@gmail.com', password: 'customer123', expectedOrders: 2 }
    ];

    for (const customer of customers) {
        console.log(`\n🧪 Testing for ${customer.email}:`);

        try {
            // Login as customer
            const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: customer.email,
                    password: customer.password
                })
            });

            if (!loginResponse.ok) {
                console.error(`❌ Login failed for ${customer.email}`);
                continue;
            }

            const loginData = await loginResponse.json();
            const token = loginData.accessToken;

            console.log(`✅ Login successful for ${customer.email}`);
            console.log(`   User ID: ${loginData.user.id}`);
            console.log(`   User Role: ${loginData.user.role}`);

            // Fetch orders with customer token
            const ordersResponse = await fetch('http://localhost:5001/api/orders', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!ordersResponse.ok) {
                console.error(`❌ Orders fetch failed for ${customer.email}: ${ordersResponse.status}`);
                continue;
            }

            const ordersData = await ordersResponse.json();
            console.log(`✅ Orders fetched successfully`);
            console.log(`📊 Found ${ordersData.data?.length || 0} orders (expected: ${customer.expectedOrders})`);

            if (ordersData.data && ordersData.data.length > 0) {
                ordersData.data.forEach((order, i) => {
                    console.log(`   Order ${i + 1}: ${order.orderNumber}`);
                    console.log(`      Customer Email: ${order.customerEmail || 'NOT FOUND'}`);
                    console.log(`      Customer Name: ${order.customer?.fullName}`);

                    // Verify the email matches
                    if (order.customerEmail === customer.email) {
                        console.log(`      ✅ Email matches logged-in customer`);
                    } else {
                        console.log(`      ❌ Email mismatch! Expected: ${customer.email}, Got: ${order.customerEmail}`);
                    }
                });
            }

            // Check if filtering worked correctly
            if (ordersData.data?.length === customer.expectedOrders) {
                console.log(`✅ CORRECT: Found exactly ${customer.expectedOrders} orders`);
            } else {
                console.log(`❌ INCORRECT: Expected ${customer.expectedOrders} orders, got ${ordersData.data?.length || 0}`);
            }

        } catch (error) {
            console.error(`❌ Error testing ${customer.email}:`, error.message);
        }

        console.log('─'.repeat(50));
    }

    console.log('\n🎯 EMAIL-BASED FILTERING TEST COMPLETE!');
}

testEmailBasedFiltering().catch(console.error);
