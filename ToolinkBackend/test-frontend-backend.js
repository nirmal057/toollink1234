// Test login functionality
import axios from 'axios';

async function testLogin() {
    console.log('🚀 Testing login functionality...');

    try {
        // Test with admin credentials
        const response = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@toollink.com',
            password: 'admin123'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Login successful:', response.data);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.log('❌ Login failed with response:', error.response.status, error.response.data);
        } else if (error.request) {
            console.log('❌ No response received:', error.request);
        } else {
            console.log('❌ Error:', error.message);
        }
        throw error;
    }
}

async function testBackendEndpoints() {
    console.log('🔍 Testing backend endpoints...');

    const endpoints = [
        '/health',
        '/api/docs',
        '/api/auth/login' // This will fail but should return proper error
    ];

    for (const endpoint of endpoints) {
        try {
            const url = `http://localhost:5001${endpoint}`;
            console.log(`Testing: ${url}`);

            let response;
            if (endpoint === '/api/auth/login') {
                // POST request with empty body (should fail properly)
                response = await axios.post(url, {}, {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                // GET request
                response = await axios.get(url);
            }

            console.log(`✅ ${endpoint}: Status ${response.status}`);
        } catch (error) {
            if (error.response) {
                console.log(`⚠️ ${endpoint}: Status ${error.response.status} (Expected for login without credentials)`);
            } else {
                console.log(`❌ ${endpoint}: Connection failed - ${error.message}`);
            }
        }
    }
}

// Run tests
async function runAllTests() {
    console.log('🧪 Starting comprehensive tests...');

    await testBackendEndpoints();

    console.log('\n📝 Attempting login with admin credentials...');
    try {
        await testLogin();
    } catch (error) {
        console.log('Login test completed (may have failed as expected)');
    }

    console.log('\n✅ All tests completed!');
}

runAllTests();
