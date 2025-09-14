const fetch = require('node-fetch');

async function testMyOrdersEndpoint() {
    try {
        console.log('=== Testing /api/orders/my-orders Endpoint ===\n');

        // Login as customer to get token
        console.log('1. Logging in as customer...');
        const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'chathursha@gmail.com',
                password: 'customer123'
            }),
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        console.log('Login response:', JSON.stringify(loginData, null, 2));

        const token = loginData.accessToken;
        if (!token) {
            throw new Error('No token received');
        }

        console.log(`✅ Login successful! Token: ${token.substring(0, 50)}...`);

        // Test the my-orders endpoint
        console.log('\n2. Testing /api/orders/my-orders endpoint...');
        const ordersResponse = await fetch('http://localhost:5001/api/orders/my-orders', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`Response status: ${ordersResponse.status}`);

        if (!ordersResponse.ok) {
            const errorText = await ordersResponse.text();
            throw new Error(`Orders request failed: ${ordersResponse.status} - ${errorText}`);
        }

        const ordersData = await ordersResponse.json();
        console.log('\nMy Orders Response:');
        console.log(JSON.stringify(ordersData, null, 2));

        // Also test the general orders endpoint for comparison
        console.log('\n3. Testing /api/orders endpoint for comparison...');
        const allOrdersResponse = await fetch('http://localhost:5001/api/orders', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (allOrdersResponse.ok) {
            const allOrdersData = await allOrdersResponse.json();
            console.log('\nAll Orders Response (for comparison):');
            console.log(`Total orders: ${allOrdersData.data?.length || 0}`);
            if (allOrdersData.data && allOrdersData.data.length > 0) {
                console.log('First order customer:', allOrdersData.data[0].customer);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testMyOrdersEndpoint();
