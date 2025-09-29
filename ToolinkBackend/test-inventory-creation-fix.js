// Test script to verify inventory creation fix
import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

async function testInventoryCreation() {
    console.log('🧪 Testing Inventory Creation Fix...\n');

    try {
        // Login as admin first
        console.log('1. Logging in as admin...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@toollink.com',
            password: 'admin123'
        });

        const token = loginResponse.data.accessToken;
        console.log('✅ Admin login successful');

        // Test creating inventory item
        console.log('\n2. Testing inventory creation...');
        const testInventoryItem = {
            name: 'Test Item - Cement Bag',
            category: 'Cement',
            quantity: 100,
            unit: 'bags', // This should now work
            threshold: 10,
            location: 'WM',
            warehouse: 'WM',
            warehouseCode: 'WM',
            description: 'Test cement bag item',
            supplier_info: {
                name: 'Test Supplier',
                contact: 'Test Contact',
                phone: '0771234567',
                email: 'supplier@test.com'
            }
        };

        const createResponse = await axios.post(`${BASE_URL}/inventory`, testInventoryItem, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (createResponse.data.success) {
            console.log('✅ Inventory item created successfully!');
            console.log('Created item:', {
                id: createResponse.data.data._id,
                name: createResponse.data.data.name,
                category: createResponse.data.data.category,
                unit: createResponse.data.data.unit,
                quantity: createResponse.data.data.quantity,
                warehouse: createResponse.data.data.warehouse
            });

            // Test fetching the created item
            console.log('\n3. Testing item retrieval...');
            const getResponse = await axios.get(`${BASE_URL}/inventory/${createResponse.data.data._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (getResponse.data.success) {
                console.log('✅ Item retrieved successfully!');
                console.log('Retrieved item:', {
                    id: getResponse.data.data._id,
                    name: getResponse.data.data.name,
                    supplier: getResponse.data.data.supplier_info?.name || 'N/A'
                });
            }

            // Clean up - delete the test item
            console.log('\n4. Cleaning up test item...');
            await axios.delete(`${BASE_URL}/inventory/${createResponse.data.data._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ Test item cleaned up');

        } else {
            console.log('❌ Failed to create inventory item:', createResponse.data.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);

        if (error.response?.data?.details) {
            console.log('\nValidation errors:');
            error.response.data.details.forEach(detail => {
                console.log(`- ${detail.msg}: ${detail.param} = "${detail.value}"`);
            });
        }
    }
}

testInventoryCreation();
