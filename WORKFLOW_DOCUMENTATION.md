# ToolLink Order Management Workflow

## Overview
This document outlines the complete workflow for the enhanced order management system where customers create orders through their portal, the system automatically splits orders by warehouse, sends targeted notifications, and provides complete management flow.

## Workflow Implementation

### 1. Customer Creates Order
- Customer logs into their portal
- Creates an order with materials from different warehouses
- System automatically splits the order by material category and warehouse
- Each sub-order contains only items of the same material category from the same warehouse

### 2. Warehouse Notifications
- System sends targeted notifications to each warehouse manager
- Each notification contains only the materials relevant to their warehouse
- Notification includes:
  - Main order number
  - Customer information
  - Material categories for their warehouse
  - Total items count
  - Clickable link to the received order form

### 3. Warehouse Manager Clicks Notification
- Notification redirects to: `/warehouse/orders/received/{mainOrderId}`
- Shows detailed order information including:
  - Customer details (name, contact, address)
  - Sub-orders for their warehouse only
  - Material details with quantities and prices
  - Scheduled delivery times
  - Order status

### 4. Order Actions Available to Warehouse Manager
- **View Order Details**: Complete order information with customer details
- **Download PDF**: Generate and download order details as PDF
- **Accept Order**: Accept the order and create delivery
- **Assign Driver**: Select available driver for delivery
- **Set Delivery Time**: Override scheduled delivery time if needed
- **Add Notes**: Add special delivery instructions

### 5. Create Delivery Process
When warehouse manager accepts an order:
- Select from available drivers
- Set estimated delivery time
- Add delivery notes
- System creates delivery record
- Assigns driver to delivery
- Marks driver as unavailable
- Sends notification to customer about delivery assignment

### 6. Customer Notifications
Customer receives notifications when:
- Order is created and split
- Each sub-order is accepted by warehouse
- Driver is assigned for delivery
- Delivery status updates

## Technical Implementation

### Backend Components

#### 1. Enhanced OrderService
- `splitMainOrder()`: Intelligent order splitting by material category and warehouse
- `sendWarehouseNotifications()`: Targeted notifications to warehouse managers
- `calculateDeliveryDate()`: Smart delivery scheduling

#### 2. New API Endpoints
- `GET /api/orders/received/:mainOrderId`: Get received order details for warehouse
- `GET /api/orders/:orderId/pdf?type=main|sub`: Generate PDF for orders
- `POST /api/orders/sub-order/:subOrderId/accept-and-create-delivery`: Accept order and create delivery
- `POST /api/notifications/:notificationId/click`: Handle notification clicks with redirect

#### 3. Enhanced Notification System
- New notification types: `NEW_ORDER_RECEIVED`, `ORDER_READY_FOR_DELIVERY`
- Click handling with automatic redirect to appropriate pages
- Role-based notification targeting

#### 4. PDF Generation
- Uses Puppeteer for professional PDF generation
- Styled HTML templates with company branding
- Separate templates for main orders and sub-orders

### Frontend Components

#### 1. WarehouseOrderReceived Component
- Complete order reception interface for warehouse managers
- Shows customer information and relevant sub-orders
- Integrated delivery creation form
- PDF download functionality
- Driver assignment interface

#### 2. Enhanced NotificationDropdown
- Clickable notifications with automatic navigation
- Mark as read functionality
- Visual distinction for unread notifications
- Real-time updates

#### 3. Order Management Enhancements
- Role-based views (customer, warehouse, admin)
- Sub-order status management
- Delivery tracking integration

## User Experience Flow

### For Customers:
1. Create order through customer portal
2. Receive confirmation email with sub-order details and delivery schedule
3. Get notifications when warehouses accept orders
4. Receive delivery assignment notifications with driver details
5. Track delivery status through dashboard

### For Warehouse Managers:
1. Receive targeted notifications about relevant orders
2. Click notification to view detailed order form
3. Download order PDF for internal processing
4. Accept order and assign driver in single action
5. Monitor delivery progress

### For Drivers:
1. Receive assignment notifications
2. Access delivery details through driver portal
3. Update delivery status (dispatched, delivered, failed)
4. Mark delivery as complete

## Features Implemented

✅ **Automatic Order Splitting**: Orders automatically split by material category and warehouse
✅ **Targeted Notifications**: Warehouse managers only see their relevant materials
✅ **Clickable Notifications**: Direct navigation to order reception form
✅ **PDF Generation**: Professional PDF export for orders
✅ **Delivery Creation**: Integrated delivery creation with driver assignment
✅ **Real-time Updates**: Status updates across the system
✅ **Role-based Access**: Different views for different user roles
✅ **Email Confirmations**: HTML email templates for order confirmations
✅ **Mobile Responsive**: Works on all device sizes

## Testing the Workflow

### Prerequisites:
- Backend server running on port 5001
- Frontend server running on port 3000
- MongoDB database connected
- Test users created with appropriate roles

### Test Steps:

1. **Create Test Data:**
   ```bash
   # Create warehouses, materials, and users through admin interface
   ```

2. **Customer Order Creation:**
   - Login as customer
   - Navigate to order creation
   - Add materials from different warehouses
   - Submit order

3. **Verify Order Splitting:**
   - Check database for sub-orders created
   - Verify each sub-order contains materials from single warehouse

4. **Warehouse Notification:**
   - Login as warehouse manager
   - Check notifications for new order alerts
   - Click notification to navigate to order form

5. **Order Processing:**
   - View order details
   - Download PDF
   - Accept order and create delivery
   - Verify driver assignment

6. **Customer Updates:**
   - Check customer receives delivery assignment notification
   - Verify order status updates in customer dashboard

## Database Schema Changes

### Notification Model Updates:
```javascript
type: {
    enum: [
        'LOW_STOCK', 'UPCOMING_DELIVERY', 'DELIVERY_DELAYED',
        'ORDER_STATUS_CHANGE', 'MATERIAL_REFILL_NEEDED',
        'NEW_ORDER_APPROVAL', 'NEW_ORDER_RECEIVED',
        'ORDER_READY_FOR_DELIVERY', 'SYSTEM'
    ]
}
```

### SubOrder Enhancements:
- `materialCategory`: Material category grouping
- `scheduledTime`: Specific delivery time slot
- `estimatedDuration`: Expected delivery duration
- `deliveryId`: Reference to created delivery

### User Model Updates:
- `assignedWarehouses`: Array of warehouse IDs for role-based filtering
- `primaryWarehouse`: Main warehouse for warehouse managers

## Security Considerations

- Role-based access control for all endpoints
- Warehouse managers can only see orders for assigned warehouses
- PDF generation includes user access verification
- Notification click handling validates user permissions

## Performance Optimizations

- Efficient database queries with proper indexing
- PDF generation with caching for repeated requests
- Real-time notification updates without polling
- Paginated order lists for large datasets

## Error Handling

- Graceful fallbacks for PDF generation failures
- Notification delivery retry mechanisms
- Comprehensive error logging
- User-friendly error messages

## Future Enhancements

- SMS notifications for urgent deliveries
- WhatsApp integration for customer communications
- Advanced delivery routing optimization
- Analytics dashboard for warehouse performance
- Mobile app for drivers
- Integration with external logistics providers

---

This implementation provides a complete end-to-end workflow for order management with intelligent splitting, targeted notifications, and seamless delivery creation process.
