// Test simple login
async function testLogin() {
    const baseURL = 'http://localhost:5001/api';

    console.log('🔐 Testing simple login...\n');

    try {
        // Test with house1 user
        const response = await fetch(`${baseURL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'house1@toollink.com',
                password: '123456'
            })
        });

        console.log('Response status:', response.status);

        const text = await response.text();
        console.log('Response body:', text);

        if (response.ok) {
            const data = JSON.parse(text);
            console.log('✅ Login successful');
            console.log('User:', data.user);
            console.log('Access Token length:', data.accessToken?.length);

            // Test inventory request
            console.log('\n🗂️ Testing inventory request...');
            const inventoryResponse = await fetch(`${baseURL}/inventory`, {
                headers: {
                    'Authorization': `Bearer ${data.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Inventory status:', inventoryResponse.status);
            const inventoryText = await inventoryResponse.text();

            if (inventoryResponse.ok) {
                const inventoryData = JSON.parse(inventoryText);
                console.log('✅ Inventory request successful');
                console.log('Items count:', inventoryData.items?.length || 0);
                if (inventoryData.items?.length > 0) {
                    console.log('Sample item:', inventoryData.items[0].name);
                }
            } else {
                console.log('❌ Inventory request failed');
                console.log('Error response:', inventoryText);
            }

        } else {
            console.log('❌ Login failed');
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testLogin().catch(console.error);
