const fetch = require('node-fetch');

async function debugCustomerLogin() {
    console.log('=== CUSTOMER LOGIN DEBUG ===\n');

    // Test customer login
    console.log('1. Testing customer login...');
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'chathursha@gmail.com',
            password: 'customer123'
        })
    });

    if (!loginResponse.ok) {
        console.error('❌ Login failed:', loginResponse.status);
        const errorText = await loginResponse.text();
        console.error('Error:', errorText);
        return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log('Login response:', JSON.stringify(loginData, null, 2));

    const token = loginData.accessToken;

    // Decode the JWT token to see what's inside
    console.log('\n2. Decoding JWT token...');
    const tokenParts = token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    console.log('Token payload:', JSON.stringify(payload, null, 2));

    // Test fetching user profile to see full user data
    console.log('\n3. Fetching user profile...');
    const profileResponse = await fetch('http://localhost:5001/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('✅ Profile data:', JSON.stringify(profileData, null, 2));
    } else {
        console.error('❌ Profile fetch failed:', profileResponse.status);
    }

    // Test orders endpoint with this customer token
    console.log('\n4. Testing orders endpoint...');
    const ordersResponse = await fetch('http://localhost:5001/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        console.log('✅ Orders response:', JSON.stringify(ordersData, null, 2));
        console.log(`\n📊 SUMMARY: Found ${ordersData.data?.length || 0} orders for customer chathursha`);

        if (ordersData.data && ordersData.data.length > 0) {
            ordersData.data.forEach((order, i) => {
                console.log(`   Order ${i + 1}: ${order.orderNumber} - Customer: ${order.customer?.fullName} (ID: ${order.customer?._id})`);
            });
        }
    } else {
        console.error('❌ Orders fetch failed:', ordersResponse.status);
        const errorText = await ordersResponse.text();
        console.error('Error:', errorText);
    }
}

debugCustomerLogin().catch(console.error);
