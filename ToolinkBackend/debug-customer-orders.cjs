const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/toollink')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection failed:', err));

// Define schemas
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  fullName: String,
  role: String,
  phone: String,
  address: String
});

const orderSchema = new mongoose.Schema({
  orderNumber: String,
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: String,
  shippingAddress: {
    street: String,
    city: String,
    zipCode: String,
    phone: String
  },
  delivery: {
    estimatedDate: Date,
    actualDate: Date
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);

async function debugCustomerOrders() {
  try {
    console.log('\n=== Customer Orders Debug ===\n');
    
    // Get all customers
    const customers = await User.find({ role: 'customer' }).lean();
    console.log(`Found ${customers.length} customers:`);
    customers.forEach(customer => {
      console.log(`- ${customer.fullName} (${customer.email}) - ID: ${customer._id}`);
    });
    
    // Get all orders
    const orders = await Order.find({}).populate('customer').lean();
    console.log(`\nFound ${orders.length} orders:`);
    orders.forEach(order => {
      console.log(`- Order ${order.orderNumber} - Customer: ${order.customer?.fullName || 'No customer'} - Customer ID: ${order.customer?._id || 'No ID'}`);
    });
    
    // Test filtering for each customer
    console.log('\n=== Testing Customer Filtering ===\n');
    for (const customer of customers) {
      console.log(`\nTesting for customer: ${customer.fullName} (${customer._id})`);
      
      // Method 1: Direct filter by customer ID (string comparison)
      const ordersMethod1 = await Order.find({ 
        customer: customer._id.toString() 
      }).populate('customer').lean();
      console.log(`Method 1 (string): Found ${ordersMethod1.length} orders`);
      
      // Method 2: Direct filter by ObjectId
      const ordersMethod2 = await Order.find({ 
        customer: customer._id 
      }).populate('customer').lean();
      console.log(`Method 2 (ObjectId): Found ${ordersMethod2.length} orders`);
      
      // Method 3: Using mongoose ObjectId
      const ordersMethod3 = await Order.find({ 
        customer: new mongoose.Types.ObjectId(customer._id) 
      }).populate('customer').lean();
      console.log(`Method 3 (new ObjectId): Found ${ordersMethod3.length} orders`);
      
      if (ordersMethod2.length > 0) {
        ordersMethod2.forEach(order => {
          console.log(`  - Order ${order.orderNumber}: ${order.items?.length || 0} items`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

debugCustomerOrders();