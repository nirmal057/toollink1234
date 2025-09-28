# Delivery Management System - Comprehensive Guide

## Overview

The Delivery Management System provides role-based delivery tracking, management, and analytics for the ToolLink platform. It integrates with the existing order management system and provides tailored functionality for each user role.

## Architecture

### Components
- **DeliveryManagementSystem.tsx** - Main delivery management interface
- **DeliveryManagement.tsx** - Integration wrapper component
- **delivery-management.js** - Backend API routes

### Database Models
- **Delivery** - Core delivery information and tracking
- **User** - Driver and user management
- **Order** - Integration with order system

## Features by Role

### 🏢 Admin
- Complete delivery oversight and analytics
- Driver management and assignments
- System-wide delivery reporting
- Failed delivery management
- Performance analytics

**Capabilities:**
- View all deliveries across all warehouses
- Assign/reassign drivers to deliveries
- Update delivery status at any stage
- Generate comprehensive reports
- Manage driver profiles and availability
- Handle failed deliveries and escalations

### 🏭 Warehouse Manager
- Outbound delivery management
- Driver assignments for warehouse deliveries
- Warehouse-specific analytics
- Inventory-to-delivery coordination

**Capabilities:**
- View deliveries from their warehouse
- Assign available drivers to deliveries
- Mark deliveries as ready for dispatch
- Track warehouse performance metrics
- Coordinate with drivers for pickups

### 💰 Cashier
- Customer delivery processing
- Payment-to-delivery coordination
- Customer service support
- Delivery scheduling

**Capabilities:**
- Process customer deliveries after payment
- Schedule delivery dates and time slots
- Handle customer delivery inquiries
- Update delivery information
- Coordinate with warehouse for dispatch

### 🚛 Driver
- Personal delivery assignments
- Route management
- Real-time status updates
- Delivery completion workflow

**Capabilities:**
- View assigned deliveries
- Update delivery status (out for delivery, delivered, failed)
- Add delivery notes and proof of delivery
- Navigate to delivery locations
- Communicate with customers

### 📦 Customer
- Personal order tracking
- Delivery status monitoring
- Delivery history
- Communication with drivers

**Capabilities:**
- Track their own deliveries
- View delivery history
- Receive status notifications
- Provide delivery feedback
- Update delivery preferences

## API Endpoints

### Core Delivery Operations

#### GET /api/delivery-management/deliveries
Get deliveries based on user role and permissions.

**Query Parameters:**
- `status`: Filter by delivery status
- `priority`: Filter by priority level
- `warehouse`: Filter by warehouse ID
- `driver`: Filter by driver ID
- `startDate`: Date range start
- `endDate`: Date range end
- `search`: Search term
- `page`: Page number for pagination
- `limit`: Items per page
- `sortBy`: Sort field
- `sortOrder`: Sort direction (asc/desc)

**Response:**
```json
{
  "success": true,
  "deliveries": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 47,
    "itemsPerPage": 10
  }
}
```

#### GET /api/delivery-management/deliveries/:id
Get single delivery details with role-based access control.

#### PUT /api/delivery-management/deliveries/:id/status
Update delivery status with role-based permissions.

**Request Body:**
```json
{
  "status": "delivered",
  "notes": "Delivered successfully to customer",
  "location": {
    "latitude": 6.9271,
    "longitude": 79.8612
  }
}
```

#### POST /api/delivery-management/deliveries/:id/assign
Assign driver to delivery (Admin/Warehouse/Cashier only).

**Request Body:**
```json
{
  "driverId": "driver-user-id"
}
```

### Driver Management

#### GET /api/delivery-management/drivers
Get available drivers with performance stats.

**Query Parameters:**
- `available`: Filter for available drivers only
- `search`: Search driver details
- `sortBy`: Sort field
- `sortOrder`: Sort direction

### Analytics

#### GET /api/delivery-management/analytics
Get comprehensive delivery analytics and performance metrics.

**Query Parameters:**
- `startDate`: Analysis period start
- `endDate`: Analysis period end
- `warehouseId`: Warehouse-specific analytics

## Integration Guide

### 1. Basic Integration

Add to your main routing file:

```tsx
import DeliveryManagement from './components/DeliveryManagement';

// In your Routes
<Route path="/delivery-management/*" element={<DeliveryManagement />} />
```

### 2. Role-Based Navigation

```tsx
const getNavigationItems = (userRole: string) => {
  const baseItems = [
    { path: '/dashboard', label: 'Dashboard', icon: HomeIcon }
  ];

  const roleSpecificItems = {
    admin: [
      { path: '/delivery-management', label: 'Delivery Management', icon: TruckIcon },
      { path: '/users', label: 'User Management', icon: UsersIcon }
    ],
    warehouse: [
      { path: '/delivery-management', label: 'Outbound Deliveries', icon: TruckIcon },
      { path: '/inventory', label: 'Inventory', icon: PackageIcon }
    ],
    driver: [
      { path: '/delivery-management', label: 'My Deliveries', icon: TruckIcon }
    ],
    customer: [
      { path: '/delivery-management', label: 'Track Orders', icon: PackageIcon },
      { path: '/orders', label: 'Order History', icon: ShoppingCartIcon }
    ]
  };

  return [...baseItems, ...(roleSpecificItems[userRole] || [])];
};
```

### 3. Order Integration

Automatically create deliveries when orders are approved:

```tsx
const handleOrderApproval = async (orderId: string, orderData: any) => {
  try {
    // Approve the order first
    await fetch(`/api/orders/${orderId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Create delivery for each sub-order or warehouse
    const deliveryPromises = orderData.subOrders.map(async (subOrder: any) => {
      const deliveryData = {
        orderId: subOrder.id,
        warehouseId: subOrder.warehouseId,
        warehouseName: subOrder.warehouseName,
        items: subOrder.items,
        deliveryDate: orderData.preferredDeliveryDate,
        timeSlot: orderData.preferredTimeSlot,
        priority: orderData.priority || 'normal',
        deliveryAddress: orderData.deliveryAddress,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        contactNumber: orderData.contactNumber,
        specialInstructions: orderData.specialInstructions
      };

      return fetch('/api/delivery-management/deliveries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deliveryData)
      });
    });

    await Promise.all(deliveryPromises);
    showSuccess('Order approved and deliveries scheduled');

  } catch (error) {
    console.error('Error processing order approval:', error);
    showError('Failed to process order approval');
  }
};
```

### 4. Real-time Updates

Integrate with WebSocket or polling for real-time delivery updates:

```tsx
const useDeliveryUpdates = (deliveryId: string) => {
  const [delivery, setDelivery] = useState(null);

  useEffect(() => {
    const fetchDeliveryStatus = async () => {
      try {
        const response = await fetch(`/api/delivery-management/deliveries/${deliveryId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setDelivery(data.delivery);
        }
      } catch (error) {
        console.error('Error fetching delivery status:', error);
      }
    };

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchDeliveryStatus, 30000);

    // Initial fetch
    fetchDeliveryStatus();

    return () => clearInterval(interval);
  }, [deliveryId]);

  return delivery;
};
```

## Customization

### 1. Status Workflow

Modify status transitions in the backend route:

```javascript
const allowedTransitions = {
  admin: ['scheduled', 'assigned', 'out_from_warehouse', 'on_the_way', 'delivered', 'failed', 'cancelled'],
  warehouse: ['scheduled', 'assigned', 'out_from_warehouse', 'cancelled'],
  cashier: ['scheduled', 'assigned', 'cancelled'],
  driver: ['out_from_warehouse', 'on_the_way', 'delivered', 'failed']
};
```

### 2. Priority Levels

Add custom priority levels:

```typescript
const priorityLevels = {
  'low': { color: 'bg-gray-100 text-gray-800', order: 1 },
  'normal': { color: 'bg-green-100 text-green-800', order: 2 },
  'urgent': { color: 'bg-yellow-100 text-yellow-800', order: 3 },
  'critical': { color: 'bg-red-100 text-red-800', order: 4 },
  'emergency': { color: 'bg-purple-100 text-purple-800', order: 5 }
};
```

### 3. Custom Filters

Add domain-specific filters:

```tsx
const CustomFilters = ({ filters, setFilters }) => (
  <div className="grid grid-cols-2 gap-4">
    {/* Vehicle Type Filter */}
    <select
      value={filters.vehicleType || 'all'}
      onChange={(e) => setFilters(prev => ({ ...prev, vehicleType: e.target.value }))}
      className="px-4 py-2 border rounded-lg"
    >
      <option value="all">All Vehicles</option>
      <option value="van">Van</option>
      <option value="truck">Truck</option>
      <option value="motorcycle">Motorcycle</option>
    </select>

    {/* District Filter */}
    <select
      value={filters.district || 'all'}
      onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value }))}
      className="px-4 py-2 border rounded-lg"
    >
      <option value="all">All Districts</option>
      <option value="colombo">Colombo</option>
      <option value="kandy">Kandy</option>
      <option value="galle">Galle</option>
    </select>
  </div>
);
```

## Performance Optimization

### 1. Pagination

The system includes built-in pagination. Adjust page size based on your needs:

```tsx
const itemsPerPage = userRole === 'driver' ? 5 : 10; // Smaller page for mobile drivers
```

### 2. Caching

Implement caching for frequently accessed data:

```tsx
const useDeliveryCache = () => {
  const [cache, setCache] = useState(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedData = (key: string) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  };

  const setCachedData = (key: string, data: any) => {
    setCache(prev => new Map(prev.set(key, {
      data,
      timestamp: Date.now()
    })));
  };

  return { getCachedData, setCachedData };
};
```

### 3. Lazy Loading

Implement lazy loading for large delivery lists:

```tsx
const useLazyDeliveries = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMoreDeliveries = useCallback(async (page: number) => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/delivery-management/deliveries?page=${page}&limit=20`);
      const data = await response.json();

      setDeliveries(prev => [...prev, ...data.deliveries]);
      setHasMore(data.pagination.currentPage < data.pagination.totalPages);
    } catch (error) {
      console.error('Error loading deliveries:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore]);

  return { deliveries, loadMoreDeliveries, loading, hasMore };
};
```

## Security Considerations

### 1. Role-Based Access Control

All API endpoints implement role-based access control. Users can only:
- View deliveries they have permission to access
- Update statuses according to their role privileges
- Assign drivers if they have management permissions

### 2. Data Validation

All inputs are validated both on frontend and backend:
- Status transitions are validated against allowed transitions
- User permissions are checked for every operation
- Input sanitization prevents injection attacks

### 3. Audit Trail

All delivery status changes are logged with:
- User who made the change
- Timestamp of the change
- Previous and new status
- Optional notes

## Troubleshooting

### Common Issues

1. **Deliveries not loading**: Check user authentication and role permissions
2. **Status updates failing**: Verify the user has permission for that status transition
3. **Driver assignments not working**: Ensure the driver is active and available
4. **Real-time updates not working**: Check WebSocket connections or polling intervals

### Debug Mode

Enable debug logging in development:

```tsx
const DEBUG_MODE = process.env.NODE_ENV === 'development';

const logDeliveryAction = (action: string, data: any) => {
  if (DEBUG_MODE) {
    console.log(`[Delivery Management] ${action}:`, data);
  }
};
```

## Future Enhancements

1. **GPS Tracking**: Real-time driver location tracking
2. **Route Optimization**: AI-powered route planning
3. **Predictive Analytics**: Delivery time estimation using ML
4. **Mobile App**: Dedicated driver mobile application
5. **Customer Notifications**: SMS/Push notifications for status updates
6. **Proof of Delivery**: Photo capture and digital signatures
7. **Integration APIs**: Third-party logistics provider integration

## Support

For technical support or feature requests:
- Create an issue in the project repository
- Contact the development team
- Refer to the API documentation for detailed endpoint information

---

This comprehensive delivery management system provides a solid foundation for managing deliveries across different user roles while maintaining security, performance, and scalability.
