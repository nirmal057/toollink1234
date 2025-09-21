// Admin Login Test
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

const testAdminLogin = async () => {
    const adminCredentials = [
        { email: 'admin@toollink.com', password: '123456' },
        { email: 'admin@toollink.com', password: 'admin123' },
        { email: 'admin@toollink.com', password: 'Admin123' },
        { email: 'admin@toollink.com', password: 'password123' }
    ];

    console.log('🔐 Testing Admin Login Credentials...\n');

    for (const cred of adminCredentials) {
        try {
            console.log(`Testing: ${cred.email} / ${cred.password}`);
            const response = await axios.post(`${API_BASE}/auth/login`, cred);

            if (response.data.success) {
                console.log(`✅ SUCCESS! Admin credentials: ${cred.email} / ${cred.password}`);
                return cred;
            }
        } catch (error) {
            console.log(`❌ Failed: ${cred.email} / ${cred.password}`);
        }
    }

    console.log('\n❌ No valid admin credentials found');
    return null;
};

testAdminLogin();
