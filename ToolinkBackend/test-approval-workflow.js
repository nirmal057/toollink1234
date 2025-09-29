import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5001/api';

// Test credentials - assuming we have these from previous setup
const ADMIN_EMAIL = 'admin@toollink.com';
const ADMIN_PASSWORD = 'admin123';
const CUSTOMER_EMAIL = 'customer@test.com';
const CUSTOMER_PASSWORD = 'customer123';

let adminToken = null;
let customerToken = null;

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (result.success) {
            return result.token;
        } else {
            throw new Error(result.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error.message);
        return null;
    }
}

async function createTestMaterial() {
    try {
        const response = await fetch(`${API_BASE}/materials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: 'Test Material for Order',
                category: 'Hardware',
                unit: 'pieces',
                description: 'Test material for approval workflow'
            })
        });

        const result = await response.json();
        if (result.success) {
            console.log('✅ Test material created:', result.data._id);
            return result.data._id;
        } else {
            throw new Error(result.error || 'Failed to create material');
        }
    } catch (error) {
        console.error('Material creation error:', error.message);
        return null;
    }
}

async function createCustomerOrder(materialId) {
    try {
        const orderData = {
            items: [
                {
                    materialId: materialId,
                    requestedQty: 10
                }
            ],
            deliveryAddress: {
                street: '123 Test Street',
                city: 'Test City',
                state: 'Test State',
                zipCode: '12345',
                phone: '555-1234'
            },
            notes: 'This is a test order for approval workflow testing'
        };

        const response = await fetch(`${API_BASE}/orders/main-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customerToken}`
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        if (result.success) {
            console.log('✅ Customer order created:', result.data.orderNumber);
            console.log('   Status:', result.data.status);
            return result.data._id;
        } else {
            throw new Error(result.error || 'Failed to create order');
        }
    } catch (error) {
        console.error('Order creation error:', error.message);
        return null;
    }
}

async function checkPendingOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders/main-orders?status=pending_approval`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const result = await response.json();
        if (result.success) {
            console.log('✅ Pending orders found:', result.data.length);
            result.data.forEach(order => {
                console.log(`   - Order: ${order.orderNumber}, Customer: ${order.customerId.fullName}, Status: ${order.status}`);
            });
            return result.data;
        } else {
            throw new Error(result.error || 'Failed to fetch pending orders');
        }
    } catch (error) {
        console.error('Pending orders check error:', error.message);
        return [];
    }
}

async function approveOrder(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/main-order/${orderId}/approve`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                notes: 'Approved via test automation'
            })
        });

        const result = await response.json();
        if (result.success) {
            console.log('✅ Order approved:', result.data.orderNumber);
            console.log('   New status:', result.data.status);
            return true;
        } else {
            throw new Error(result.error || 'Failed to approve order');
        }
    } catch (error) {
        console.error('Order approval error:', error.message);
        return false;
    }
}

async function runApprovalWorkflowTest() {
    console.log('🚀 Starting Order Approval Workflow Test...\n');

    // 1. Login as admin
    console.log('1. Logging in as admin...');
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!adminToken) {
        console.log('❌ Admin login failed - cannot continue test');
        return;
    }
    console.log('✅ Admin logged in successfully\n');

    // 2. Login as customer
    console.log('2. Logging in as customer...');
    customerToken = await login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    if (!customerToken) {
        console.log('❌ Customer login failed - cannot continue test');
        return;
    }
    console.log('✅ Customer logged in successfully\n');

    // 3. Create test material
    console.log('3. Creating test material...');
    const materialId = await createTestMaterial();
    if (!materialId) {
        console.log('❌ Material creation failed - cannot continue test');
        return;
    }
    console.log('✅ Test material created\n');

    // 4. Create customer order
    console.log('4. Creating customer order...');
    const orderId = await createCustomerOrder(materialId);
    if (!orderId) {
        console.log('❌ Order creation failed - cannot continue test');
        return;
    }
    console.log('✅ Customer order created\n');

    // 5. Check pending orders as admin
    console.log('5. Checking pending orders as admin...');
    const pendingOrders = await checkPendingOrders();
    if (pendingOrders.length === 0) {
        console.log('❌ No pending orders found - workflow may have issues');
        return;
    }
    console.log('✅ Pending orders retrieved\n');

    // 6. Approve the order
    console.log('6. Approving the order...');
    const approved = await approveOrder(orderId);
    if (!approved) {
        console.log('❌ Order approval failed');
        return;
    }
    console.log('✅ Order approved successfully\n');

    // 7. Verify no more pending orders
    console.log('7. Verifying approval workflow...');
    const remainingPending = await checkPendingOrders();
    if (remainingPending.some(order => order._id === orderId)) {
        console.log('❌ Order still shows as pending after approval');
        return;
    }
    console.log('✅ Order approval workflow completed successfully\n');

    console.log('🎉 All tests passed! Order approval workflow is working correctly.');
}

// Run the test
runApprovalWorkflowTest().catch(console.error);
