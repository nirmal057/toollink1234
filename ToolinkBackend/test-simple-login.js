// Simple test script to test the new test-login endpoint
import fetch from 'node-fetch';

async function testSimpleLogin() {
    try {
        console.log('🔍 Testing simple login endpoint...');

        const response = await fetch('http://localhost:5000/api/auth/test-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@toollink.com',
                password: 'admin123'
            })
        });

        const data = await response.json();

        console.log('✅ Response status:', response.status);
        console.log('✅ Response data:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('🎉 Simple login test successful!');
        } else {
            console.log('❌ Simple login test failed:', data.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSimpleLogin();
