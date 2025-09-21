const axios = require('axios');

async function loginAndTestApproval() {
    try {
        console.log('Testing order approval with authentication...');

        // Step 1: Login as warehouse user to get a token
        console.log('\n1. Logging in as warehouse user...');
        const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'house1@gmail.com',
            password: '123456'
        });

        if (!loginResponse.data.success) {
            throw new Error('Failed to login: ' + JSON.stringify(loginResponse.data));
        }

        console.log('Full login response:', JSON.stringify(loginResponse.data, null, 2));

        const token = loginResponse.data.token || loginResponse.data.accessToken;
        console.log('Login successful, token obtained:', token ? 'YES' : 'NO');

        // Step 2: Get all orders to see what's available
        console.log('\n2. Getting all orders...');
        const ordersResponse = await axios.get('http://localhost:5001/api/orders', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Orders response status:', ordersResponse.status);
        console.log('Number of orders:', ordersResponse.data.data?.length || 0);

        // Find pending approval orders
        const allOrders = ordersResponse.data.data || [];
        const pendingOrders = allOrders.filter(order => order.status === 'Pending Approval');

        console.log(`Found ${pendingOrders.length} pending approval orders`);

        if (pendingOrders.length > 0) {
            const testOrder = pendingOrders[0];
            console.log('\n3. Testing approval for order:', testOrder._id);
            console.log('Order details:', {
                id: testOrder._id,
                orderNumber: testOrder.orderNumber,
                status: testOrder.status,
                customer: testOrder.customer?.fullName || testOrder.customer,
                items: testOrder.items?.length || 'unknown'
            });

            // Try to approve the order
            console.log('\n4. Attempting to approve order...');
            const approvalResponse = await axios.patch(
                `http://localhost:5001/api/orders/${testOrder._id}/approve`,
                { notes: 'Test approval via debug script' },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Approval response status:', approvalResponse.status);
            console.log('Approval response:', approvalResponse.data);

        } else {
            console.log('No pending approval orders found to test with');

            // Show first few orders for debugging
            if (allOrders.length > 0) {
                console.log('\nFirst 3 orders for reference:');
                allOrders.slice(0, 3).forEach((order, index) => {
                    console.log(`${index + 1}. ${order.orderNumber || order._id} - Status: ${order.status}`);
                });
            }
        }

    } catch (error) {
        console.error('\nError details:');
        console.error('- Status:', error.response?.status);
        console.error('- Data:', error.response?.data);
        console.error('- Message:', error.message);

        if (error.response?.status === 401) {
            console.error('AUTHENTICATION FAILED - Check admin credentials');
        } else if (error.response?.status === 403) {
            console.error('AUTHORIZATION FAILED - User lacks approval permissions');
        }
    }
}

loginAndTestApproval();
