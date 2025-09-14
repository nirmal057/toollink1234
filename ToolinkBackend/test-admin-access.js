// Simple test script to verify all admin routes work correctly
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5001';

// Test login first to get admin token
const testAdminAccess = async () => {
    try {
        console.log('🔐 Testing admin login...');

        // Login as admin
        const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@toollink.com',
                password: 'admin123'
            })
        });

        const loginData = await loginResponse.json();

        console.log('Login response status:', loginResponse.status);
        console.log('Login response data:', loginData);

        if (!loginData.success) {
            console.error('❌ Login failed:', loginData.error);
            console.error('Error type:', loginData.errorType);
            console.error('Additional info:', loginData);
            return;
        }

        console.log('✅ Admin login successful');
        console.log('- User role:', loginData.user.role);
        console.log('- Token exists:', !!loginData.accessToken);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

testAdminAccess();
