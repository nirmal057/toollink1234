import mongoose from 'mongoose';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/toollink');

console.log('📦 Creating test order with automatic sub-order generation...');

// Get existing data
const Material = mongoose.model('Material', {}, 'materials');
const Warehouse = mongoose.model('Warehouse', {}, 'warehouses');
const User = mongoose.model('User', {}, 'users');

// Create Order schema
const orderSchema = new mongoose.Schema({
    orderNumber: String,
    customerEmail: String,
    customerId: mongoose.Schema.Types.ObjectId,
    items: [{
        materialName: String,
        quantity: Number,
        warehouseCode: String
    }],
    status: String,
    totalAmount: Number,
    createdAt: Date,
    requestedDeliveryDate: Date,
    notes: String
});

const Order = mongoose.model('Order', orderSchema, 'orders');

// Create SubOrder schema
const subOrderSchema = new mongoose.Schema({
    subOrderNumber: String,
    mainOrderId: mongoose.Schema.Types.ObjectId,
    warehouseCode: String,
    items: [{
        materialName: String,
        quantity: Number
    }],
    status: String,
    createdAt: Date
});

const SubOrder = mongoose.model('SubOrder', subOrderSchema, 'suborders');

try {
    // Get customer
    const customer = await User.findOne({ email: 'iit21063@std.uwu.ac.lk' });

    if (!customer) {
        throw new Error('Customer not found');
    }

    // Generate order number
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `ORD-${dateStr}-0001`;

    // Create main order with the 3 specific items requested
    const mainOrder = new Order({
        orderNumber: orderNumber,
        customerEmail: customer.email,
        customerId: customer._id,
        items: [
            { materialName: 'Binding Wire 20kg', quantity: 10, warehouseCode: 'W3' },
            { materialName: 'Kelani River Sand - Fine', quantity: 2, warehouseCode: 'W1' },
            { materialName: 'Clay Brick - Solid', quantity: 500, warehouseCode: 'W2' }
        ],
        status: 'confirmed',
        totalAmount: 3500,
        createdAt: now,
        requestedDeliveryDate: new Date('2025-10-15'),
        notes: 'New order with 3 specific items: Binding Wire, Kelani River Sand, Clay Brick'
    });

    const savedOrder = await mainOrder.save();
    console.log(`✅ Main order created: ${savedOrder.orderNumber}`);

    // Group items by warehouse and create sub-orders
    const warehouseGroups = {};
    savedOrder.items.forEach(item => {
        if (!warehouseGroups[item.warehouseCode]) {
            warehouseGroups[item.warehouseCode] = [];
        }
        warehouseGroups[item.warehouseCode].push({
            materialName: item.materialName,
            quantity: item.quantity
        });
    });

    // Create sub-orders for each warehouse
    const subOrders = [];
    let subOrderCounter = 1;

    for (const [warehouseCode, items] of Object.entries(warehouseGroups)) {
        const subOrderNumber = `${orderNumber}-SUB-${warehouseCode}`;

        const subOrder = new SubOrder({
            subOrderNumber: subOrderNumber,
            mainOrderId: savedOrder._id,
            warehouseCode: warehouseCode,
            items: items,
            status: 'pending',
            createdAt: now
        });

        const savedSubOrder = await subOrder.save();
        subOrders.push(savedSubOrder);

        console.log(`✅ Sub-order created: ${savedSubOrder.subOrderNumber} for warehouse ${warehouseCode}`);
        console.log(`   Items: ${items.map(i => `${i.materialName} (${i.quantity})`).join(', ')}`);
    }

    console.log('');
    console.log('🎯 Order creation completed!');
    console.log(`📦 Main Order: ${savedOrder.orderNumber}`);
    console.log(`🏪 Sub-Orders: ${subOrders.length} created`);

} catch (error) {
    console.error('❌ Error creating test order:', error);
} finally {
    await mongoose.disconnect();
    console.log('📡 Database connection closed');
}
