// Test script for warehouse categories API
import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

async function testWarehouseCategories() {
    console.log('🧪 Testing Warehouse Categories API...\n');

    try {
        // Test 1: Get categories without authentication (should fail)
        console.log('Test 1: Testing unauthorized access...');
        try {
            await axios.get(`${BASE_URL}/inventory/warehouse-categories`);
        } catch (error) {
            console.log('✅ Unauthorized access properly blocked:', error.response?.status);
        }

        // Test 2: Login as admin
        console.log('\nTest 2: Logging in as admin...');
        const adminLoginData = {
            email: 'admin@toollink.com',
            password: 'admin123'
        };

        const adminLoginResponse = await axios.post(`${BASE_URL}/auth/login`, adminLoginData);
        const adminToken = adminLoginResponse.data.accessToken;
        console.log('✅ Admin login successful');

        // Test 3: Get warehouse categories as admin
        console.log('\nTest 3: Getting warehouse categories as admin...');
        const adminCategoriesResponse = await axios.get(`${BASE_URL}/inventory/warehouse-categories`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        console.log('✅ Admin categories response:');
        console.log('User role:', adminCategoriesResponse.data.data.userRole);
        console.log('All warehouses keys:', Object.keys(adminCategoriesResponse.data.data.allWarehouses || {}));

        // Test 4: Login as warehouse user
        console.log('\nTest 4: Logging in as warehouse user (WM)...');
        const warehouseLoginData = {
            email: 'main_house@toollink.com',
            password: 'warehouse123'
        };

        try {
            const warehouseLoginResponse = await axios.post(`${BASE_URL}/auth/login`, warehouseLoginData);
            const warehouseToken = warehouseLoginResponse.data.accessToken;
            console.log('✅ Warehouse login successful');

            // Test 5: Get warehouse categories as warehouse user
            console.log('\nTest 5: Getting warehouse categories as warehouse user...');
            const warehouseCategoriesResponse = await axios.get(`${BASE_URL}/inventory/warehouse-categories`, {
                headers: { 'Authorization': `Bearer ${warehouseToken}` }
            });

            console.log('✅ Warehouse categories response:');
            console.log('User role:', warehouseCategoriesResponse.data.data.userRole);
            console.log('Warehouse:', warehouseCategoriesResponse.data.data.warehouse);
            console.log('Categories count:', warehouseCategoriesResponse.data.data.categories?.length || 0);

            if (warehouseCategoriesResponse.data.data.categories) {
                warehouseCategoriesResponse.data.data.categories.forEach(cat => {
                    console.log(`  - ${cat._id}: ${cat.count} items`);
                });
            }
        } catch (error) {
            console.log('⚠️ Warehouse user login/access failed:', error.response?.data?.message || error.message);
        }

        // Test 6: Test inventory stats endpoint
        console.log('\nTest 6: Testing inventory stats endpoint...');
        const statsResponse = await axios.get(`${BASE_URL}/inventory/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        console.log('✅ Stats response:');
        console.log('Total items:', statsResponse.data.data.totalItems);
        console.log('Categories:', statsResponse.data.data.categories);
        console.log('Warehouse specific:', statsResponse.data.data.warehouseSpecific);
        console.log('All warehouses:', statsResponse.data.data.allWarehouses);

    } catch (error) {
        console.error('❌ Error during testing:', error.response?.data || error.message);
    }
}

testWarehouseCategories();
