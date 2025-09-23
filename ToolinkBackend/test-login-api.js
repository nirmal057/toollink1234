import fetch from 'node-fetch';

async function testLogin() {
    try {
        console.log('Testing login API...\n');

        const loginData = {
            email: 'admin@toollink.com',
            password: 'admin123'
        };

        const response = await fetch('http://localhost:5001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));

        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok && data.success) {
            console.log('\n✅ Login successful!');
            console.log('User:', data.user);
            console.log('Token received:', !!data.accessToken);
        } else {
            console.log('\n❌ Login failed!');
            console.log('Error:', data.error);
        }

    } catch (error) {
        console.error('\n💥 Connection error:', error.message);
        console.log('Make sure the backend server is running on port 5001');
    }
}

testLogin();
