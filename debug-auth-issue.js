const { default: fetch } = await import('node-fetch');

// Test the authentication flow
async function testAuthFlow() {
    console.log('🔍 Testing Authentication Flow...\n');

    // Clear any existing tokens
    console.log('1. Clearing localStorage (simulated)');
    console.log('   - localStorage.clear() would be called in browser\n');

    // Test backend login API
    console.log('2. Testing Backend Login API');
    try {
        const loginUrl = 'http://localhost:5001/api/auth/login';
        const credentials = {
            email: 'admin@toollink.com',
            password: 'admin123'
        };

        console.log(`   URL: ${loginUrl}`);
        console.log(`   Credentials: ${JSON.stringify(credentials)}`);

        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        console.log(`   Response Status: ${response.status} ${response.statusText}`);

        const data = await response.json();
        console.log(`   Response Data:`, JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log('   ✅ Backend Login API is working correctly!');

            // Test token validation
            console.log('\n3. Testing Token Validation');
            const token = data.accessToken;
            if (token) {
                try {
                    // Decode JWT payload
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                    console.log(`   Token Payload:`, JSON.stringify(payload, null, 2));

                    const currentTime = Math.floor(Date.now() / 1000);
                    const isExpired = payload.exp < currentTime;
                    console.log(`   Token Expired: ${isExpired}`);
                    console.log(`   Token Valid Until: ${new Date(payload.exp * 1000).toISOString()}`);
                } catch (e) {
                    console.log(`   ❌ Error parsing token: ${e.message}`);
                }
            }
        } else {
            console.log('   ❌ Backend Login API failed');
        }
    } catch (error) {
        console.log(`   ❌ Error testing backend: ${error.message}`);
    }

    // Test CORS
    console.log('\n4. Testing CORS');
    try {
        const corsResponse = await fetch('http://localhost:5001/api/auth/login', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:5174',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        console.log(`   CORS Preflight Status: ${corsResponse.status}`);
        console.log(`   CORS Headers:`, Object.fromEntries(corsResponse.headers.entries()));
    } catch (error) {
        console.log(`   ❌ CORS Error: ${error.message}`);
    }

    // Frontend debugging tips
    console.log('\n5. Frontend Debugging Tips:');
    console.log('   - Open browser console and check for errors');
    console.log('   - Check Network tab for failed requests');
    console.log('   - Test with: window.debugAuth() in browser console');
    console.log('   - Clear auth data with: window.clearAuth() in browser console');
    console.log('   - Force logout with: window.forceLogout() in browser console');

    console.log('\n6. Common Issues to Check:');
    console.log('   - Frontend API base URL (should be http://localhost:5001)');
    console.log('   - CORS configuration in backend');
    console.log('   - AuthTokenManager validation logic');
    console.log('   - useAuth hook synchronization');
    console.log('   - Browser localStorage corruption');
}

testAuthFlow().catch(console.error);
