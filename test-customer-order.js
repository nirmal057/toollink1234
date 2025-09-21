// Test Order Creation for specific customer
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

const testCustomerOrder = async () => {
    try {
        console.log('🔐 Testing order creation for customer: iit21026@std.uwu.ac.lk');

        // Login customer
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'iit21026@std.uwu.ac.lk',
            password: 'iit21026'  // Use username as password
        });

        if (!loginResponse.data.success) {
            console.log('❌ Login failed:', loginResponse.data.error);
            return;
        }

        console.log('✅ Customer login successful');
        const customerToken = loginResponse.data.accessToken;

        console.log('User details:', loginResponse.data?.user);

        // Get inventory
        console.log('\n📦 Fetching inventory...');
        const inventoryResponse = await axios.get(`${API_BASE}/inventory`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });

        const inventory = inventoryResponse.data.data?.items || inventoryResponse.data.items || [];
        console.log(`✅ Found ${inventory.length} inventory items`);

        if (inventory.length === 0) {
            console.log('❌ No inventory items found');
            return;
        }

        // Use first item with stock
        const availableItem = inventory.find(item => item.current_stock > 0);
        if (!availableItem) {
            console.log('❌ No items with stock found');
            return;
        }

        console.log(`📦 Using item: ${availableItem.name} (Stock: ${availableItem.current_stock})`);

        // Create order
        console.log('\n🛒 Creating order...');
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
            notes: 'Test order from customer iit21026'
        };

        console.log('Order data:', JSON.stringify(orderData, null, 2));

        const orderResponse = await axios.post(`${API_BASE}/orders`, orderData, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });

        if (orderResponse.data.success) {
            const order = orderResponse.data.data;
            console.log('✅ Order created successfully!');
            console.log(`   Order Number: #${order.orderNumber}`);
            console.log(`   Status: ${order.status}`);
            console.log(`   Total: Rs. ${order.totalAmount}`);
            console.log(`   Items: ${order.items.length}`);
        } else {
            console.log('❌ Order creation failed:', orderResponse.data.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.error || error.message);
        if (error.response?.data) {
            console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
};

testCustomerOrder();
