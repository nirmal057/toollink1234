const axios = require('axios');

async function testOrderApproval() {
    try {
        console.log('Testing order approval workflow...');

        // First, let's get all orders to see what's available
        console.log('\n1. Getting all orders...');
        const ordersResponse = await axios.get('http://localhost:5001/api/orders');
        console.log('Orders Response:', ordersResponse.data);

        // Find a pending approval order
        const pendingOrders = ordersResponse.data.orders?.filter(order =>
            order.status === 'Pending Approval'
        ) || [];

        console.log(`\nFound ${pendingOrders.length} pending approval orders`);

        if (pendingOrders.length > 0) {
            const testOrder = pendingOrders[0];
            console.log('\n2. Testing approval for order:', testOrder._id);

            // Try to approve the order
            const approvalResponse = await axios.put(
                `http://localhost:5001/api/orders/${testOrder._id}/approve`,
                {},
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Approval Response:', approvalResponse.data);
        } else {
            console.log('No pending approval orders found');
        }

    } catch (error) {
        console.error('Error details:');
        console.error('- Status:', error.response?.status);
        console.error('- Data:', error.response?.data);
        console.error('- Message:', error.message);
    }
}

testOrderApproval();
