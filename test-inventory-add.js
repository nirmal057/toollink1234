// Test script to add inventory data
import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

// Test data for different warehouses
const testInventoryItems = [
    {
        name: 'Test Sand',
        category: 'Fine Sand',
        quantity: 100,
        unit: 'cubic_ft',
        threshold: 10,
        location: 'W1',
        warehouse: 'W1',
        warehouseCode: 'W1',
        description: 'Test sand item'
    },
    {
        name: 'Test Cement Block',
        category: '6 Inch Blocks',
        quantity: 50,
        unit: 'pieces',
        threshold: 5,
        location: 'W2',
        warehouse: 'W2',
        warehouseCode: 'W2',
        description: 'Test cement block'
    },
    {
        name: 'Test Steel Rod',
        category: '10mm Steel Rods',
        quantity: 20,
        unit: 'pieces',
        threshold: 5,
        location: 'W3',
        warehouse: 'W3',
        warehouseCode: 'W3',
        description: 'Test steel rod'
    },
    {
        name: 'Test Drill',
        category: 'Power Drills',
        quantity: 5,
        unit: 'pieces',
        threshold: 2,
        location: 'WM',
        warehouse: 'WM',
        warehouseCode: 'WM',
        description: 'Test power drill'
    }
];

// Admin credentials (you'll need to get a valid token)
async function login() {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@toollink.com',
            password: 'admin123'
        });
        return response.data.token;
    } catch (error) {
        console.error('Login failed:', error.response?.data || error.message);
        return null;
    }
}

async function addInventoryItem(item, token) {
    try {
        const response = await axios.post(`${BASE_URL}/inventory`, item, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Successfully added: ${item.name}`);
        return response.data;
    } catch (error) {
        console.error(`❌ Failed to add ${item.name}:`, error.response?.data || error.message);
        return null;
    }
}

async function testAddInventory() {
    console.log('🧪 Testing inventory addition with warehouse codes...\n');

    // Login first
    const token = await login();
    if (!token) {
        console.error('Cannot proceed without authentication token');
        return;
    }

    console.log('✅ Successfully authenticated\n');

    // Test each inventory item
    for (const item of testInventoryItems) {
        console.log(`📦 Adding ${item.name} to ${item.warehouse}...`);
        await addInventoryItem(item, token);
        console.log(''); // Empty line for readability
    }

    console.log('🎯 Test completed!');
}

// Run the test
testAddInventory().catch(console.error);
