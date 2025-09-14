// Simple backend test script
import axios from 'axios';

async function testBackend() {
    try {
        console.log('Testing backend health endpoint...');
        const response = await axios.get('http://localhost:5001/health');
        console.log('✅ Backend health check passed:', response.data);

        console.log('Testing API docs endpoint...');
        const docsResponse = await axios.get('http://localhost:5001/api/docs');
        console.log('✅ API docs accessible:', docsResponse.data.message);

        console.log('🎉 Backend is working correctly!');
    } catch (error) {
        console.error('❌ Backend test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Make sure the backend server is running on port 5001');
        }
    }
}

testBackend();
