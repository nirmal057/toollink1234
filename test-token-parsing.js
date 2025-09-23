// Test the token parsing logic that might be causing auth issues

function testTokenParsing() {
    console.log('🔍 Testing Token Parsing Logic...\n');

    // This is the actual token from our backend test
    const sampleToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODgzMjM5YmMxZjBjMWZmYjhmMGJmMTciLCJpYXQiOjE3NTg2MDA5MTksImV4cCI6MTc1ODYwNDUxOX0.3mQmD3rXUVVr73wjWXpVty1nY6lzkfZ7_kvckysKOCc";

    console.log('Original token length:', sampleToken.length);
    console.log('Token parts:', sampleToken.split('.').length);

    try {
        // Test the exact logic from AuthTokenManager
        const payload = JSON.parse(atob(sampleToken.split('.')[1]));
        console.log('✅ Token payload parsed successfully:', payload);

        const currentTime = Math.floor(Date.now() / 1000);
        const isExpired = payload.exp < currentTime;

        console.log('Current time (Unix):', currentTime);
        console.log('Token expires (Unix):', payload.exp);
        console.log('Token expired?', isExpired);
        console.log('Token valid until:', new Date(payload.exp * 1000).toISOString());
        console.log('Time until expiry (minutes):', Math.floor((payload.exp - currentTime) / 60));

    } catch (error) {
        console.error('❌ Error parsing token:', error);
    }

    // Test edge cases
    console.log('\n🧪 Testing Edge Cases...');

    // Test with undefined/null
    testTokenExpiry(null, 'null token');
    testTokenExpiry(undefined, 'undefined token');
    testTokenExpiry('', 'empty token');
    testTokenExpiry('invalid.token', 'invalid format');
    testTokenExpiry('a.b.c', 'invalid base64');

    // Test the user validation logic
    console.log('\n👤 Testing User Data Validation...');
    testUserValidation('{"id":"123","email":"test@test.com","role":"admin"}', 'valid user');
    testUserValidation('{"email":"test@test.com","role":"admin"}', 'missing id');
    testUserValidation('{"id":"123","role":"admin"}', 'missing email');
    testUserValidation('{"id":"123","email":"test@test.com"}', 'missing role');
    testUserValidation('invalid json', 'invalid JSON');
    testUserValidation(null, 'null user');
}

function testTokenExpiry(token, description) {
    try {
        if (!token) {
            console.log(`  ${description}: expired (no token)`);
            return;
        }

        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        const isExpired = payload.exp < currentTime;
        console.log(`  ${description}: ${isExpired ? 'expired' : 'valid'}`);
    } catch (error) {
        console.log(`  ${description}: expired (parse error: ${error.message})`);
    }
}

function testUserValidation(userJson, description) {
    try {
        if (!userJson) {
            console.log(`  ${description}: invalid (no data)`);
            return;
        }

        const userData = JSON.parse(userJson);
        const isValid = userData.id && userData.email && userData.role;
        console.log(`  ${description}: ${isValid ? 'valid' : 'invalid'} - id:${!!userData.id} email:${!!userData.email} role:${!!userData.role}`);
    } catch (error) {
        console.log(`  ${description}: invalid (parse error: ${error.message})`);
    }
}

testTokenParsing();
