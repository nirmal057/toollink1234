import fetch from 'node-fetch';

// Test customer login to get proper authentication token
async function testCustomerLogin() {
    try {
        // Test login for each customer
        const customers = [
            { email: 'john.smith@example.com', password: 'password123' },
            { email: 'sarah.johnson@example.com', password: 'password123' },
            { email: 'mike.brown@example.com', password: 'password123' }
        ];

        for (const customer of customers) {
            console.log(`\n=== Testing login for ${customer.email} ===`);

            const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(customer),
            });

            if (loginResponse.ok) {
                const loginData = await loginResponse.json();
                console.log('✅ Login successful');
                console.log('Token:', loginData.accessToken?.substring(0, 50) + '...');
                console.log('User:', loginData.user?.fullName);
                console.log('Role:', loginData.user?.role);

                // Test fetching customer's orders with their token
                const ordersResponse = await fetch('http://localhost:5001/api/orders/my-orders', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${loginData.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (ordersResponse.ok) {
                    const ordersData = await ordersResponse.json();
                    console.log('✅ Orders fetched successfully');
                    console.log('Orders count:', ordersData.data?.length || 0);

                    if (ordersData.data && ordersData.data.length > 0) {
                        console.log('First order:', ordersData.data[0].orderNumber);
                        console.log('Customer:', ordersData.data[0].customer?.fullName);
                    }
                } else {
                    console.log('❌ Failed to fetch orders:', ordersResponse.status);
                }
            } else {
                console.log('❌ Login failed:', loginResponse.status);
                const errorData = await loginResponse.text();
                console.log('Error:', errorData);
            }
        }

    } catch (error) {
        console.error('Error during testing:', error.message);
    }
}

// Run the test
testCustomerLogin();
