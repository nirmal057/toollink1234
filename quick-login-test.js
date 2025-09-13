// Quick login test without stopping the server
const testLogin = async () => {
    try {
        console.log('🔍 Testing login API...');

        const response = await fetch('http://localhost:5001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@toollink.com',
                password: 'admin123'
            })
        });

        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            console.log('✅ LOGIN SUCCESS!');
            console.log('🎫 Access token received:', !!data.accessToken);
            console.log('👤 User data:', data.user);
        } else {
            console.log('❌ LOGIN FAILED:', data.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

testLogin();
