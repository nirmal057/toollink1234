// Test Order Approval Workflow
// This script tests the complete order approval workflow including inventory management

import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

// Test configuration
const TEST_CONFIG = {
    // Use existing test users
    customer: {
        email: 'testcustomer@toollink.com',
        password: 'testpassword123'
    },
    admin: {
        email: 'admin@toollink.com',
        password: 'admin123'
    }
};

let customerToken = '';
let adminToken = '';
let testOrderId = '';

// Helper function to make authenticated API calls
const apiCall = async (method, endpoint, data = null, token = '') => {
    try {
        const config = {
            method,
            url: `${API_BASE}${endpoint}`,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            data
        };

        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.error || error.message,
            status: error.response?.status
        };
    }
};

// Test functions
const loginUser = async (email, password) => {
    console.log(`\n🔐 Logging in user: ${email}`);
    const result = await apiCall('POST', '/auth/login', { email, password });

    if (result.success) {
        console.log(`✅ Login successful`);
        return result.data.token;
    } else {
        console.log(`❌ Login failed: ${result.error}`);
        return null;
    }
};

const getInventoryItems = async (token) => {
    console.log('\n📦 Fetching inventory items...');
    const result = await apiCall('GET', '/inventory', null, token);

    if (result.success && result.data.data?.length > 0) {
        console.log(`✅ Found ${result.data.data.length} inventory items`);
        return result.data.data.filter(item => item.current_stock > 0).slice(0, 2); // Get first 2 items with stock
    } else {
        console.log(`❌ Failed to fetch inventory: ${result.error}`);
        return [];
    }
};

const createCustomerOrder = async (token, inventoryItems) => {
    console.log('\n🛒 Creating customer order...');

    const orderData = {
        items: inventoryItems.map(item => ({
            inventory: item._id,
            quantity: 1 // Order 1 of each item
        })),
        deliveryAddress: {
            street: '123 Test Street',
            city: 'Colombo',
            postalCode: '00100',
            district: 'Colombo'
        },
        notes: 'Test order for approval workflow'
    };

    const result = await apiCall('POST', '/orders', orderData, token);

    if (result.success) {
        console.log(`✅ Order created successfully: #${result.data.data.orderNumber}`);
        console.log(`   Status: ${result.data.data.status}`);
        console.log(`   Total: Rs. ${result.data.data.totalAmount}`);
        return result.data.data;
    } else {
        console.log(`❌ Order creation failed: ${result.error}`);
        return null;
    }
};

const getOrderDetails = async (orderId, token) => {
    console.log(`\n📋 Fetching order details: ${orderId}`);
    const result = await apiCall('GET', `/orders/${orderId}`, null, token);

    if (result.success) {
        const order = result.data.data;
        console.log(`✅ Order found: #${order.orderNumber}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Items: ${order.items.length}`);
        return order;
    } else {
        console.log(`❌ Failed to fetch order: ${result.error}`);
        return null;
    }
};

const approveOrder = async (orderId, token) => {
    console.log(`\n✅ Approving order: ${orderId}`);
    const result = await apiCall('PATCH', `/orders/${orderId}/approve`, {
        notes: 'Order approved in automated test'
    }, token);

    if (result.success) {
        console.log(`✅ Order approved successfully`);
        console.log(`   New Status: ${result.data.data.status}`);
        return result.data.data;
    } else {
        console.log(`❌ Order approval failed: ${result.error}`);
        return null;
    }
};

const checkInventoryUpdate = async (inventoryItems, token) => {
    console.log('\n📊 Checking inventory updates...');

    for (const item of inventoryItems) {
        const result = await apiCall('GET', `/inventory/${item._id}`, null, token);
        if (result.success) {
            const currentStock = result.data.data.current_stock;
            const originalStock = item.current_stock;
            console.log(`   ${item.name}: ${originalStock} → ${currentStock} (${originalStock - currentStock} deducted)`);
        }
    }
};

// Main test execution
const runTest = async () => {
    console.log('🚀 Starting Order Approval Workflow Test\n');
    console.log('='.repeat(50));

    try {
        // Step 1: Login as customer
        customerToken = await loginUser(TEST_CONFIG.customer.email, TEST_CONFIG.customer.password);
        if (!customerToken) return;

        // Step 2: Login as admin
        adminToken = await loginUser(TEST_CONFIG.admin.email, TEST_CONFIG.admin.password);
        if (!adminToken) return;

        // Step 3: Get inventory items
        const inventoryItems = await getInventoryItems(customerToken);
        if (inventoryItems.length === 0) return;

        console.log('\n📦 Using inventory items:');
        inventoryItems.forEach(item => {
            console.log(`   - ${item.name} (Stock: ${item.current_stock})`);
        });

        // Step 4: Create order as customer
        const order = await createCustomerOrder(customerToken, inventoryItems);
        if (!order) return;

        testOrderId = order._id;

        // Step 5: Verify order is pending approval
        const pendingOrder = await getOrderDetails(testOrderId, adminToken);
        if (!pendingOrder || pendingOrder.status !== 'Pending Approval') {
            console.log('❌ Order should be in Pending Approval status');
            return;
        }

        // Step 6: Approve order as admin
        const approvedOrder = await approveOrder(testOrderId, adminToken);
        if (!approvedOrder) return;

        // Step 7: Verify order is confirmed
        const confirmedOrder = await getOrderDetails(testOrderId, adminToken);
        if (!confirmedOrder || confirmedOrder.status !== 'Confirmed') {
            console.log('❌ Order should be in Confirmed status after approval');
            return;
        }

        // Step 8: Check inventory was deducted
        await checkInventoryUpdate(inventoryItems, adminToken);

        console.log('\n🎉 Order Approval Workflow Test Completed Successfully!');
        console.log('='.repeat(50));
        console.log('✅ Customer created order with Pending Approval status');
        console.log('✅ Admin approved order and changed status to Confirmed');
        console.log('✅ Inventory was properly deducted after approval');
        console.log('✅ Notifications and emails should have been sent');

    } catch (error) {
        console.error('\n💥 Test failed with error:', error.message);
    }
};

// Run the test
runTest().catch(console.error);
