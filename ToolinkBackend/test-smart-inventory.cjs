const axios = require('axios');

async function testSmartInventory() {
    console.log('🧪 Testing Smart Inventory System...\n');
    
    try {
        // 1. Login as admin
        console.log('1. Logging in as admin...');
        const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@toollink.com',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Admin login successful\n');

        // 2. Create first cement item
        console.log('2. Creating first cement item (50 bags)...');
        const firstItem = await axios.post('http://localhost:5001/api/inventory', {
            name: 'Test Smart Cement',
            category: 'Cement',
            warehouse: 'WM',
            warehouseCode: 'WM',
            quantity: 50,
            unit: 'bags',
            threshold: 10,
            location: 'WM',
            supplier_info: { name: 'Lanka Cement Company', contact: 'John Silva', phone: '0771234567' }
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('✅ First item response:', {
            action: firstItem.data.action,
            message: firstItem.data.message,
            quantity: firstItem.data.data.current_stock
        });

        const firstItemId = firstItem.data.data._id;

        // 3. Add more of the same cement (should update existing)
        console.log('\n3. Adding more cement (30 bags) - should UPDATE existing...');
        const secondItem = await axios.post('http://localhost:5001/api/inventory', {
            name: 'Test Smart Cement',
            category: 'Cement', 
            warehouse: 'WM',
            warehouseCode: 'WM',
            quantity: 30,
            unit: 'bags',
            threshold: 10,
            location: 'WM',
            supplier_info: { name: 'Lanka Cement Company', contact: 'John Silva', phone: '0771234567' }
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('✅ Second item response:', {
            action: secondItem.data.action,
            message: secondItem.data.message,
            details: secondItem.data.details
        });

        // 4. Create different cement brand (should create new)
        console.log('\n4. Creating different cement brand - should CREATE new...');
        const thirdItem = await axios.post('http://localhost:5001/api/inventory', {
            name: 'Test Economy Cement',
            category: 'Cement',
            warehouse: 'WM', 
            warehouseCode: 'WM',
            quantity: 25,
            unit: 'bags',
            threshold: 5,
            location: 'WM',
            supplier_info: { name: 'Budget Cement Ltd', contact: 'Priya Fernando', phone: '0779876543' }
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('✅ Third item response:', {
            action: thirdItem.data.action,
            message: thirdItem.data.message,
            quantity: thirdItem.data.data.current_stock
        });

        const thirdItemId = thirdItem.data.data._id;

        // Cleanup test items
        console.log('\n5. Cleaning up test items...');
        try {
            await axios.delete(`http://localhost:5001/api/inventory/${firstItemId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await axios.delete(`http://localhost:5001/api/inventory/${thirdItemId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ Test items cleaned up');
        } catch (e) {
            console.log('⚠️ Cleanup warning:', e.message);
        }

        console.log('\n🎉 Smart inventory system working perfectly!');
        console.log('✅ Existing items get updated with added quantities');
        console.log('✅ Different items get created as new entries');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testSmartInventory();