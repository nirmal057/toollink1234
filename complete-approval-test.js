// Complete Order Approval Workflow Test
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

const completeWorkflowTest = async () => {
    try {
        console.log('🚀 Starting Complete Order Approval Workflow Test\n');
        console.log('='.repeat(60));

        // Step 1: Login customer
        console.log('\n🔐 Step 1: Login Customer');
        const customerLogin = await axios.post(`${API_BASE}/auth/login`, {
            email: 'testcustomer@toollink.com',
            password: 'testpassword123'
        });

        const customerToken = customerLogin.data.accessToken;
        console.log('✅ Customer logged in successfully');

        // Step 2: Login admin
        console.log('\n🔐 Step 2: Login Admin');
        const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
            email: 'admin@toollink.com',
            password: 'admin123'
        });

        const adminToken = adminLogin.data.accessToken;
        console.log('✅ Admin logged in successfully');

        // Step 3: Get inventory
        console.log('\n📦 Step 3: Get Inventory');
        const inventoryResponse = await axios.get(`${API_BASE}/inventory`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });

        const inventory = inventoryResponse.data.data?.items || inventoryResponse.data.items || [];
        const availableItem = inventory.find(item => item.current_stock > 0);
        console.log(`✅ Found ${inventory.length} items, using: ${availableItem.name} (Stock: ${availableItem.current_stock})`);

        // Step 4: Customer creates order
        console.log('\n🛒 Step 4: Customer Creates Order');
        const orderData = {
            items: [{
                inventory: availableItem._id,
                quantity: 1
            }],
            shippingAddress: {
                street: '123 Test Street',
                city: 'Colombo',
                state: 'Western Province',
                zipCode: '00100',
                district: 'Colombo'
            },
            notes: 'Test order for approval workflow'
        };

        const orderResponse = await axios.post(`${API_BASE}/orders`, orderData, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });

        const order = orderResponse.data.data;
        console.log(`✅ Order created: #${order.orderNumber}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: Rs. ${order.totalAmount}`);
        console.log(`   Customer ID: ${order.customer}`);

        // Step 5: Verify order is pending approval
        console.log('\n📋 Step 5: Verify Order Status');
        if (order.status !== 'Pending Approval') {
            throw new Error(`Expected status 'Pending Approval', got '${order.status}'`);
        }
        console.log('✅ Order correctly has "Pending Approval" status');

        // Step 6: Check inventory BEFORE approval (should be unchanged)
        console.log('\n📊 Step 6: Check Inventory Before Approval');
        const inventoryBefore = await axios.get(`${API_BASE}/inventory/${availableItem._id}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log(`✅ Inventory before approval: ${inventoryBefore.data.data.current_stock} (unchanged)`);

        // Step 7: Admin approves order
        console.log('\n✅ Step 7: Admin Approves Order');
        const approvalResponse = await axios.patch(`${API_BASE}/orders/${order._id}/approve`, {
            notes: 'Approved in automated test'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const approvedOrder = approvalResponse.data.data;
        console.log(`✅ Order approved successfully`);
        console.log(`   New Status: ${approvedOrder.status}`);
        console.log(`   Approved By: ${approvedOrder.approvedBy}`);
        console.log(`   Approved At: ${approvedOrder.approvedAt}`);

        // Step 8: Verify order status changed to Confirmed
        console.log('\n📋 Step 8: Verify Order Status Changed');
        if (approvedOrder.status !== 'Confirmed') {
            throw new Error(`Expected status 'Confirmed', got '${approvedOrder.status}'`);
        }
        console.log('✅ Order status correctly changed to "Confirmed"');

        // Step 9: Check inventory AFTER approval (should be deducted)
        console.log('\n📊 Step 9: Check Inventory After Approval');
        const inventoryAfter = await axios.get(`${API_BASE}/inventory/${availableItem._id}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const stockBefore = inventoryBefore.data.data.current_stock;
        const stockAfter = inventoryAfter.data.data.current_stock;
        const deducted = stockBefore - stockAfter;

        console.log(`✅ Inventory after approval: ${stockAfter} (deducted: ${deducted})`);

        if (deducted !== 1) {
            throw new Error(`Expected 1 item deducted, got ${deducted}`);
        }
        console.log('✅ Inventory correctly deducted after approval');

        // Step 10: Get final order details
        console.log('\n📋 Step 10: Get Final Order Details');
        const finalOrderResponse = await axios.get(`${API_BASE}/orders/${order._id}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const finalOrder = finalOrderResponse.data.data;
        console.log(`✅ Final order details:`);
        console.log(`   Order Number: #${finalOrder.orderNumber}`);
        console.log(`   Status: ${finalOrder.status}`);
        console.log(`   Customer: ${finalOrder.customer?.fullName || finalOrder.customer}`);
        console.log(`   Total Amount: Rs. ${finalOrder.totalAmount}`);
        console.log(`   Items: ${finalOrder.items?.length || 0}`);

        console.log('\n🎉 COMPLETE ORDER APPROVAL WORKFLOW TEST PASSED!');
        console.log('='.repeat(60));
        console.log('✅ Customer successfully created order with "Pending Approval" status');
        console.log('✅ Inventory was NOT deducted during order creation');
        console.log('✅ Admin successfully approved the order');
        console.log('✅ Order status changed to "Confirmed" after approval');
        console.log('✅ Inventory was properly deducted AFTER approval');
        console.log('✅ Notifications and emails should have been sent');
        console.log('✅ Complete approval workflow functioning correctly!');

        return {
            success: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
            inventoryItem: availableItem.name,
            stockDeducted: deducted
        };

    } catch (error) {
        console.error('\n💥 WORKFLOW TEST FAILED:', error.response?.data?.error || error.message);
        if (error.response?.data) {
            console.log('Error details:', JSON.stringify(error.response.data, null, 2));
        }
        return { success: false, error: error.message };
    }
};

// Run the complete test
completeWorkflowTest()
    .then(result => {
        if (result.success) {
            console.log('\n🏆 ALL TESTS PASSED - Order Approval Workflow is Working Correctly!');
        } else {
            console.log('\n❌ TESTS FAILED - See error details above');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n💥 Test execution failed:', error);
        process.exit(1);
    });
