import fetch from 'node-fetch';

async function testDriverAPI() {
    try {
        console.log('🧪 Testing driver API endpoint...');
        
        // First login to get a token
        console.log('🔐 Logging in as admin...');
        const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@toollink.com',
                password: 'admin123'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.accessToken;
        console.log('✅ Login successful');
        
        // Test drivers endpoint
        console.log('📋 Testing /api/drivers endpoint...');
        const driversResponse = await fetch('http://localhost:5001/api/drivers', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!driversResponse.ok) {
            throw new Error(`Drivers API failed: ${driversResponse.status}`);
        }
        
        const driversData = await driversResponse.json();
        console.log('✅ Drivers API successful');
        console.log('\n📊 API Response:');
        console.log(JSON.stringify(driversData, null, 2));
        
        // Test unassigned deliveries endpoint
        console.log('\n📦 Testing /api/drivers/unassigned endpoint...');
        const unassignedResponse = await fetch('http://localhost:5001/api/drivers/unassigned', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!unassignedResponse.ok) {
            console.log(`⚠️ Unassigned deliveries API returned: ${unassignedResponse.status}`);
            const errorText = await unassignedResponse.text();
            console.log('Error details:', errorText);
        } else {
            const unassignedData = await unassignedResponse.json();
            console.log('✅ Unassigned deliveries API successful');
            console.log('\n📦 Unassigned Deliveries Response:');
            console.log(JSON.stringify(unassignedData, null, 2));
        }
        
    } catch (error) {
        console.error('❌ API Test failed:', error.message);
    }
}

// Run the test
testDriverAPI();