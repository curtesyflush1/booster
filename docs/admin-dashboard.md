# Admin Dashboard System

The Admin Dashboard provides comprehensive management capabilities for BoosterBeacon administrators. This system includes user management, ML model oversight, system health monitoring, and audit logging.

## ✅ Completed Features

### Backend Implementation

#### Admin Authentication & Authorization
- **Role-Based Access Control**: Three-tier permission system (user, admin, super_admin)
- **Granular Permissions**: Fine-grained permission system for different admin functions
- **Middleware Protection**: Secure middleware for admin route protection
- **Permission Validation**: Dynamic permission checking for admin operations

#### User Management System
- **Advanced User Search**: Search by email, name with fuzzy matching
- **Comprehensive Filtering**: Filter by role, subscription tier, verification status, date ranges
- **Pagination Support**: Efficient pagination for large user datasets
- **User Statistics**: Real-time user metrics and analytics
- **Role Management**: Update user roles and permissions with audit logging
- **Account Suspension**: Temporary and permanent account suspension capabilities
- **Secure User Deletion**: Soft delete with data anonymization

#### ML Model Management
- **Model Oversight**: View and manage all ML models in the system
- **Training Controls**: Trigger model training and retraining jobs
- **Model Deployment**: Deploy trained models to production
- **Training Data Review**: Review and approve/reject training data
- **ML Statistics**: Performance metrics and model accuracy tracking
- **Audit Integration**: Complete logging of all ML operations

#### System Health Monitoring
- **Real-Time Metrics**: CPU, memory, disk usage monitoring
- **Uptime Tracking**: System uptime and availability metrics
- **API Performance**: Response time and error rate monitoring
- **Database Health**: Connection pool and query performance
- **Service Status**: Monitor all system components and dependencies

#### Audit Logging System
- **Complete Action Tracking**: Log all administrative actions
- **IP and User Agent Logging**: Security tracking for admin operations
- **Searchable Audit Trail**: Filter and search audit logs
- **Compliance Support**: Detailed logging for regulatory compliance
- **Data Integrity**: Immutable audit log entries

### Frontend Implementation

#### Dashboard Overview
- **Statistics Dashboard**: Real-time system and user metrics
- **Visual Analytics**: Charts and graphs for key performance indicators
- **Quick Actions**: Common administrative tasks accessible from dashboard
- **System Status**: At-a-glance system health indicators

#### User Management Interface
- **User Table**: Sortable, filterable user list with pagination
- **Advanced Search**: Real-time search with multiple criteria
- **Bulk Operations**: Select and perform actions on multiple users
- **User Details**: Comprehensive user profile and activity view
- **Role Assignment**: Easy role and permission management interface

#### ML Model Interface
- **Model Status**: View active, training, and deployed models
- **Training Controls**: Start, stop, and monitor training jobs
- **Performance Metrics**: Model accuracy and prediction statistics
- **Data Review**: Interface for reviewing and approving training data

#### System Health Interface
- **Health Dashboard**: Visual system health monitoring
- **Performance Graphs**: Real-time performance metrics
- **Alert System**: Notifications for system issues
- **Service Status**: Status of all system components

## API Endpoints

### Dashboard Statistics
```http
GET /api/admin/dashboard/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1250,
      "active": 1180,
      "new_today": 15,
      "new_this_week": 89,
      "pro_subscribers": 234,
      "conversion_rate": 18.72
    },
    "alerts": {
      "total_sent": 45678,
      "sent_today": 234,
      "pending": 12,
      "failed": 3,
      "success_rate": 98.7,
      "avg_delivery_time": 1.2
    },
    "system": {
      "uptime": 2592000,
      "cpu_usage": 45.2,
      "memory_usage": 67.8,
      "disk_usage": 23.4,
      "api_response_time": 120,
      "error_rate": 0.1
    },
    "ml_models": {
      "active_models": 3,
      "training_models": 1,
      "last_training": "2024-08-27T10:30:00Z",
      "prediction_accuracy": 94.5
    }
  }
}
```

### User Management
```http
GET /api/admin/users?page=1&limit=50&search=john&role=user
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "john@example.com",
        "role": "user",
        "subscription_tier": "pro",
        "email_verified": true,
        "watch_count": 15,
        "alert_count": 234,
        "created_at": "2024-01-15T10:30:00Z",
        "last_activity": "2024-08-27T09:15:00Z"
      }
    ],
    "total": 1250,
    "page": 1,
    "limit": 50
  }
}
```

### User Role Update
```http
PUT /api/admin/users/:userId/role
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "role": "admin",
  "permissions": ["user_management", "analytics_view"]
}
```

### User Suspension
```http
PUT /api/admin/users/:userId/suspend
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "suspend": true,
  "reason": "Terms of service violation"
}
```

### ML Model Management
```http
GET /api/admin/ml/models
Authorization: Bearer <admin_token>
```

```http
POST /api/admin/ml/models/:modelName/retrain
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "config": {
    "epochs": 100,
    "learning_rate": 0.001
  }
}
```

### System Health
```http
GET /api/admin/system/health
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 2592000,
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "email": "healthy",
      "ml_service": "healthy"
    },
    "metrics": {
      "cpu_usage": 45.2,
      "memory_usage": 67.8,
      "disk_usage": 23.4,
      "api_response_time": 120
    }
  }
}
```

### Audit Logs
```http
GET /api/admin/audit/logs?page=1&limit=50&action=user_suspended
Authorization: Bearer <admin_token>
```

## Permission System

### Admin Permissions
- `USER_MANAGEMENT`: View and manage user accounts
- `USER_SUSPEND`: Suspend and unsuspend user accounts
- `ML_MODEL_TRAINING`: Manage ML models and training
- `ML_DATA_REVIEW`: Review and approve training data
- `ANALYTICS_VIEW`: View system analytics and reports
- `AUDIT_LOG_VIEW`: View audit logs and system events

### Role Hierarchy
1. **Super Admin**: All permissions, can manage other admins
2. **Admin**: Most permissions, cannot manage other admins
3. **User**: No admin permissions

## Security Features

### Authentication
- JWT token-based authentication
- Role-based access control
- Permission-based route protection
- Session management and token refresh

### Audit Trail
- Complete logging of all admin actions
- IP address and user agent tracking
- Immutable audit log entries
- Searchable and filterable audit history

### Data Protection
- Sensitive data masking in logs
- Secure user deletion (soft delete with anonymization)
- Encrypted credential storage
- Rate limiting on admin endpoints

## Frontend Components

### AdminDashboardPage
- Main dashboard with tabbed navigation
- Real-time statistics and metrics
- System health monitoring
- User management interface

### Key Features
- **Responsive Design**: Mobile-optimized admin interface
- **Real-Time Updates**: Live data updates without page refresh
- **Advanced Filtering**: Multiple filter criteria with search
- **Bulk Operations**: Select and manage multiple items
- **Error Handling**: Comprehensive error handling and user feedback

## Usage Examples

### Accessing Admin Dashboard
1. Login with admin credentials
2. Navigate to `/admin` route
3. Dashboard automatically loads with current statistics
4. Use tabs to navigate between different management areas

### Managing Users
1. Go to Users tab in admin dashboard
2. Use search and filters to find specific users
3. Click on user to view detailed information
4. Use action buttons to update roles, suspend, or delete users

### ML Model Management
1. Navigate to ML Models tab
2. View current model status and performance
3. Trigger retraining for specific models
4. Review and approve training data

### System Monitoring
1. Check System Health tab for real-time metrics
2. Monitor service status and performance
3. View historical performance data
4. Set up alerts for system issues

## Testing Tools

To streamline validation of end-to-end flows, the admin panel includes a dedicated Testing Tools section. These tools surface safe, auditable actions designed for staging and local development. In development (`NODE_ENV=development`), some checks are relaxed to speed iteration; in production, RBAC permissions are strictly enforced and all actions are audited.

### Available Test Actions

- Simulated Purchase
  - Endpoint: `POST /api/admin/test-purchase`
  - Purpose: Queues a simulated auto-purchase job to validate orchestration and reporting without live checkout.
  - Input: `productId`, `retailerSlug`, `maxPrice`, `qty`, `alertAt?`

- Synthetic Restock Alert
  - Endpoint: `POST /api/admin/test-alert/restock`
  - Purpose: Exercises the alert generation and delivery pipeline (email/Discord/web push/SMS).
  - Input: `userId?`, `productId`, `retailerSlug`, `price?`, `productUrl?`, `watchId?`

- Recent Transactions
  - Endpoint: `GET /api/admin/purchases/transactions/recent?limit=50`
  - Purpose: Quickly review recent synthetic or live transactions for verification.

### Admin Utilities

- Set Password by Email
  - Endpoint: `POST /api/admin/users/set-password`
  - Input: `email`, `newPassword`

- Grant Admin Role by Email
  - Endpoint: `POST /api/admin/users/grant-admin`
  - Input: `email`

- Lookup User by Email
  - Endpoint: `GET /api/admin/users/by-email?email=user@example.com`

All testing actions emit audit logs with actor, payload summary, and timestamp. Rate limits apply per environment and role.

## Development Notes

### Adding New Admin Features
1. Add new permission to `AdminPermissions` enum
2. Create controller method with proper validation
3. Add route with appropriate middleware
4. Update frontend interface
5. Add audit logging for new actions

### Testing Admin Features
- Use admin test accounts with different permission levels
- Test permission boundaries and access control
- Verify audit logging for all admin actions
- Test error handling and edge cases

## Future Enhancements

### Planned Features
- **Advanced Analytics**: More detailed system analytics and reporting
- **Automated Alerts**: System health alerts and notifications
- **Bulk User Operations**: Import/export user data
- **Advanced ML Controls**: More granular ML model management
- **Custom Dashboards**: Configurable admin dashboard widgets

### Performance Optimizations
- **Caching**: Cache frequently accessed admin data
- **Pagination**: Optimize large dataset handling
- **Real-Time Updates**: WebSocket-based real-time updates
- **Background Jobs**: Async processing for heavy admin operations

---

The Admin Dashboard system provides a comprehensive management interface for BoosterBeacon administrators, ensuring secure and efficient system administration with complete audit trails and real-time monitoring capabilities.
GET /api/admin/ml/models/price/metadata

Returns metadata for the active price model used by the heuristic/OLS runner.

Response:
{
  "success": true,
  "data": {
    "trainedAt": "2025-09-02T11:40:00.000Z",
    "features": ["bias","recent","prev","trend","msrp","popNorm"],
    "coef": [1.23, 0.45, ...],
    "file": {
      "path": "/app/data/ml/price_model.json",
      "sizeBytes": 512,
      "modifiedAt": "2025-09-02T11:40:01.000Z"
    }
  }
}

Retraining Flow
- POST /api/admin/ml/models/price/retrain triggers ETL + training synchronously and returns updated model record with metrics.
- Metrics include at least:
  - rows: number of training rows generated
  - r2: training set R² approximation
