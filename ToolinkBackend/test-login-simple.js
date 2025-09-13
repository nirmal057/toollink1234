// Simple test script to test login endpoint
import fetch from 'node-fetch';

async function testLogin() {
    try {
        console.log('🔍 Testing login endpoint...');

        const response = await fetch('http://localhost:5000/api/auth/login', {
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
        console.log('✅ Response data:', data);

        if (data.success) {
            console.log('🎉 Login successful!');
            console.log('🔑 Token:', data.token?.substring(0, 20) + '...');
        } else {
            console.log('❌ Login failed:', data.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testLogin();
