const testLogin = async () => {
    try {
        console.log('🧪 Testing login API...');

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

        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

        const responseData = await response.text();
        console.log('📡 Response body:', responseData);

        if (response.headers.get('content-type')?.includes('application/json')) {
            try {
                const jsonData = JSON.parse(responseData);
                console.log('📦 Parsed JSON:', JSON.stringify(jsonData, null, 2));
            } catch (parseError) {
                console.log('❌ JSON parse error:', parseError.message);
            }
        }

    } catch (error) {
        console.error('❌ Error testing login:', error.message);
        console.error('Full error:', error);
    }
};

testLogin();
