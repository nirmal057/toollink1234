// Simple Order Approval Test
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

const testOrderApproval = async () => {
    try {
        console.log('🧪 Testing Order Approval Functionality\n');

        // Step 1: Login as customer
        console.log('🔐 Step 1: Login Customer');
        const customerResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'testcustomer@toollink.com',
            password: '123456'
        });

        if (!customerResponse.data.success) {
            throw new Error('Customer login failed: ' + customerResponse.data.error);
        }

        const customerToken = customerResponse.data.accessToken;
        console.log('✅ Customer logged in successfully');

        // Step 2: Login as admin
        console.log('\n🔐 Step 2: Login Admin');
        const adminResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'admin@toollink.com',
            password: 'admin123'
        });

        if (!adminResponse.data.success) {
            throw new Error('Admin login failed: ' + adminResponse.data.error);
        }

        const adminToken = adminResponse.data.accessToken;
        console.log('✅ Admin logged in successfully');

        // Step 3: Get available inventory
        console.log('\n📦 Step 3: Get Available Inventory');
        const inventoryResponse = await axios.get(`${API_BASE}/inventory`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const inventoryData = inventoryResponse.data.data || inventoryResponse.data;
        let availableItems = [];

        if (inventoryData.items && Array.isArray(inventoryData.items)) {
            availableItems = inventoryData.items.filter(item => item.current_stock > 0 && item.status === 'active');
        } else if (Array.isArray(inventoryData)) {
            availableItems = inventoryData.filter(item => item.current_stock > 0 && item.status === 'active');
        }

        if (availableItems.length === 0) {
            console.log('Inventory response structure:', Object.keys(inventoryData));
            throw new Error('No available inventory items found');
        }

        const testItem = availableItems[0];
        console.log(`✅ Found available item: ${testItem.name} (Stock: ${testItem.current_stock})`);

        // Step 4: Customer creates order
        console.log('\n🛒 Step 4: Customer Creates Order');
        const orderData = {
            items: [{
                inventory: testItem._id,
                quantity: 1,
                price: testItem.price || 100
            }],
            shippingAddress: {
                street: "123 Test Street",
                city: "Test City",
                state: "Test State",
                zipCode: "12345",
                phone: "0771234567"
            },
            billingAddress: {
                street: "123 Test Street",
                city: "Test City",
                state: "Test State",
                zipCode: "12345",
                phone: "0771234567"
            },
            delivery: {
                type: "standard",
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
        };

        const orderResponse = await axios.post(`${API_BASE}/orders`, orderData, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });

        if (!orderResponse.data.success) {
            throw new Error('Order creation failed: ' + orderResponse.data.error);
        }

        const order = orderResponse.data.data;
        console.log(`✅ Order created: #${order.orderNumber} (Status: ${order.status})`);

        if (order.status !== 'Pending Approval') {
            throw new Error(`Expected "Pending Approval" status, got "${order.status}"`);
        }

        // Step 5: Admin approves order
        console.log('\n✅ Step 5: Admin Approves Order');
        const approvalResponse = await axios.patch(`${API_BASE}/orders/${order._id}/approve`, {
            notes: 'Test approval'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (!approvalResponse.data.success) {
            throw new Error('Order approval failed: ' + approvalResponse.data.error);
        }

        const approvedOrder = approvalResponse.data.data;
        console.log(`✅ Order approved! New status: ${approvedOrder.status}`);

        if (approvedOrder.status !== 'Confirmed') {
            throw new Error(`Expected "Confirmed" status after approval, got "${approvedOrder.status}"`);
        }

        // Step 6: Verify order status
        console.log('\n📋 Step 6: Verify Final Order Status');
        const finalOrderResponse = await axios.get(`${API_BASE}/orders/${order._id}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const finalOrder = finalOrderResponse.data.data;
        console.log(`✅ Final order status: ${finalOrder.status}`);
        console.log(`✅ Approved by: ${finalOrder.approvedBy}`);
        console.log(`✅ Approved at: ${finalOrder.approvedAt}`);

        console.log('\n🎉 ORDER APPROVAL TEST PASSED!');
        console.log('✅ Order was successfully approved and status changed to "Confirmed"');
        console.log('✅ Customer should have received notification and email');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);

        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
};

testOrderApproval();
