import fetch from 'node-fetch';

const testLogin = async () => {
    try {
        console.log('🔐 Testing admin login...');

        // Step 1: Login to get token
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

        const loginData = await loginResponse.json();

        if (!loginData.success) {
            console.error('❌ Login failed:', loginData);
            return;
        }

        console.log('✅ Login successful!');
        console.log('User:', loginData.user.fullName, '(' + loginData.user.email + ')');
        console.log('Role:', loginData.user.role);

        const token = loginData.accessToken;
        console.log('Token received:', token ? 'Yes' : 'No');

        // Step 2: Test authenticated API calls
        console.log('\n📊 Testing API endpoints with token...');

        const endpoints = [
            '/api/users',
            '/api/inventory',
            '/api/orders',
            '/api/admin/dashboard'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`\n🔍 Testing ${endpoint}...`);
                const response = await fetch(`http://localhost:5001${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    console.log(`✅ ${endpoint}: Success`);
                    if (data.data && Array.isArray(data.data)) {
                        console.log(`   📦 Returned ${data.data.length} items`);
                        if (data.data.length > 0) {
                            console.log(`   📋 Sample item:`, Object.keys(data.data[0]).slice(0, 3).join(', '));
                        }
                    } else if (data.data) {
                        console.log(`   📦 Returned object with keys:`, Object.keys(data.data).slice(0, 5).join(', '));
                    }
                } else {
                    console.log(`❌ ${endpoint}: Failed`);
                    console.log(`   Error:`, data.error || 'Unknown error');
                }
            } catch (error) {
                console.log(`❌ ${endpoint}: Request failed -`, error.message);
            }
        }

        console.log('\n✅ API testing complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
};

testLogin();
