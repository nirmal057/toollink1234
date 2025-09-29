#!/usr/bin/env node

/**
 * Test Warehouse Sub-Orders System
 * This script tests the warehouse-specific sub-order filtering and refresh functionality
 */

import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3001';
const TEST_USERS = [
    { email: 'house1@toollink.com', password: '123456', expected: 'W1' },
    { email: 'house2@toollink.com', password: '123456', expected: 'W2' },
    { email: 'house3@toollink.com', password: '123456', expected: 'W3' },
    { email: 'main_house@toollink.com', password: '123456', expected: 'WM' }
];

async function testWarehouseSubOrders() {
    console.log('🧪 TESTING WAREHOUSE SUB-ORDERS SYSTEM');
    console.log('='.repeat(60));

    for (const testUser of TEST_USERS) {
        console.log(`\n📋 Testing ${testUser.email} (Expected: ${testUser.expected})`);
        console.log('-'.repeat(50));

        try {
            // 1. Login
            console.log('🔐 Step 1: Login...');
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });

            if (!loginResponse.data.success) {
                console.log('❌ Login failed:', loginResponse.data.error);
                continue;
            }

            const token = loginResponse.data.accessToken;
            const userInfo = loginResponse.data.user;
            console.log('✅ Login successful');
            console.log(`   User: ${userInfo.fullName || userInfo.username}`);
            console.log(`   Role: ${userInfo.role}`);
            console.log(`   Warehouse Code: ${userInfo.warehouseCode}`);

            // 2. Test Debug Endpoint
            console.log('\n🔍 Step 2: Check warehouse data...');
            try {
                const debugResponse = await axios.get(`${BASE_URL}/api/orders/debug/warehouse-data`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (debugResponse.data.success) {
                    const debug = debugResponse.data.debug;
                    console.log('✅ Debug data retrieved');
                    console.log(`   Effective Warehouse: ${debug.effectiveWarehouse}`);
                    console.log(`   User Sub-Orders: ${debug.userSubOrderCount}`);
                    console.log('   Warehouse Counts:', debug.warehouseCounts);
                } else {
                    console.log('❌ Debug failed:', debugResponse.data.error);
                }
            } catch (debugError) {
                console.log('❌ Debug endpoint error:', debugError.response?.data?.error || debugError.message);
            }

            // 3. Test Specific Warehouse Endpoint
            console.log('\n🏭 Step 3: Test specific warehouse endpoint...');
            try {
                const warehouseResponse = await axios.get(`${BASE_URL}/api/orders/sub-orders/warehouse/${testUser.expected}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (warehouseResponse.data.success) {
                    console.log('✅ Warehouse endpoint successful');
                    console.log(`   Sub-Orders Found: ${warehouseResponse.data.subOrders?.length || 0}`);
                    console.log(`   Warehouse: ${warehouseResponse.data.warehouseCode}`);
                    console.log(`   Warehouse Name: ${warehouseResponse.data.warehouseName}`);
                } else {
                    console.log('❌ Warehouse endpoint failed:', warehouseResponse.data.error);
                }
            } catch (warehouseError) {
                console.log('❌ Warehouse endpoint error:', warehouseError.response?.data?.error || warehouseError.message);
            }

            // 4. Test Auto-Detection Endpoint
            console.log('\n🎯 Step 4: Test auto-detection endpoint...');
            try {
                const autoResponse = await axios.get(`${BASE_URL}/api/orders/sub-orders/my-warehouse`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (autoResponse.data.success) {
                    console.log('✅ Auto-detection endpoint successful');
                    console.log(`   Auto-Detected Warehouse: ${autoResponse.data.warehouseCode}`);
                    console.log(`   Sub-Orders Found: ${autoResponse.data.subOrders?.length || 0}`);
                    console.log(`   Warehouse Name: ${autoResponse.data.warehouseName}`);

                    if (autoResponse.data.warehouseCode === testUser.expected) {
                        console.log('✅ Warehouse correctly auto-detected!');
                    } else {
                        console.log(`❌ Warehouse mismatch! Expected: ${testUser.expected}, Got: ${autoResponse.data.warehouseCode}`);
                    }
                } else {
                    console.log('❌ Auto-detection failed:', autoResponse.data.error);
                }
            } catch (autoError) {
                console.log('❌ Auto-detection error:', autoError.response?.data?.error || autoError.message);
            }

        } catch (error) {
            console.log('❌ Test failed for', testUser.email, ':', error.response?.data?.error || error.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 WAREHOUSE SUB-ORDERS TESTING COMPLETE');
}

// Run the test
testWarehouseSubOrders().catch(error => {
    console.error('💥 Test script error:', error);
    process.exit(1);
});
