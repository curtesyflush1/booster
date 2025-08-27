# BoosterBeacon 🚀

> Collector-grade alerting service for Pokémon TCG collectors

BoosterBeacon is a real-time monitoring and alerting system that helps Pokémon TCG collectors never miss a drop. Get instant notifications when sealed products restock at major retailers with official cart deep-links for one-tap purchasing.

## ✨ Features

- **⚡ Real-time alerts** - Get notified within 5 seconds of product availability
- **📱 Multi-channel notifications** - Web push, email, SMS, and Discord support
- **🛒 Official cart links** - One-tap add-to-cart for instant purchasing
- **🏪 Cross-retailer monitoring** - Best Buy, Walmart, Costco, and Sam's Club
- **🤖 Predictive analytics** - Price forecasting and ROI estimates
- **🔧 Browser extension** - Automated checkout assistance
- **📱 PWA mobile app** - Barcode scanning and offline capability

## 🏗️ Architecture

```
booster/
├── backend/          # Node.js/Express API server
├── frontend/         # React PWA application  
├── extension/        # Browser extension
├── shared/           # Shared code and types
└── docs/            # Documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **Docker** and Docker Compose
- **Git**

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/curtesyflush1/booster.git
   cd booster
   ```

2. **Run the setup script**
   ```bash
   chmod +x scripts/setup-dev.sh
   ./scripts/setup-dev.sh
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

The setup script will:
- Install all dependencies
- Start Docker services (PostgreSQL, Redis)
- Run database migrations
- Seed development data
- Run initial tests

### Manual Setup

If you prefer manual setup:

```bash
# Install dependencies
npm install

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Start Docker services
npm run docker:dev

# Run database migrations
npm run migrate:up

# Seed development data
npm run seed:dev

# Start development servers
npm run dev
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run integration tests (requires Docker services)
npm run test:integration

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run extension tests only
npm run test:extension

# Run smoke tests only
npm run test -- tests/smoke.test.ts
```

### Test Requirements

- **Docker services must be running** for integration tests
- **PostgreSQL test database** on port 5435
- **Redis** on port 6380
- Current test coverage: **48% statements, 75% functions** (will increase as features are added)
- Target coverage: **90%+ for production** (currently adjusted for early development)

## 🐳 Docker Commands

```bash
# Start development environment
npm run docker:dev

# Build and start (rebuild containers)
npm run docker:dev:build

# View logs
npm run docker:dev:logs

# Stop services
npm run docker:dev:down
```

## 📊 Database Management

```bash
# Run migrations
npm run migrate:up

# Rollback migrations
npm run migrate:down

# Seed development data
npm run seed:dev

# Backup database
npm run db:backup
```

## 🚀 Production Deployment

The application uses PM2 for production process management with the following configuration:

### PM2 Configuration
- **Cluster mode**: Utilizes all available CPU cores
- **Auto-restart**: Restarts on crashes with exponential backoff
- **Memory management**: Restarts if memory usage exceeds 1GB
- **Logging**: Structured logs with timestamps in `./logs/` directory
- **Health monitoring**: Minimum uptime requirements and restart limits

### Deployment Process
```bash
# Deploy to production (full pipeline)
./scripts/deploy.sh

# Quick deployment options
./scripts/deploy.sh sync-only    # Only sync files
./scripts/deploy.sh restart-only # Only restart services
./scripts/deploy.sh check        # Health check only
./scripts/deploy.sh rollback     # Rollback to previous release
```

The deployment script performs:
1. **Pre-deployment checks** - Tests and build validation
2. **Atomic deployment** - Zero-downtime release switching
3. **Database migrations** - Automatic schema updates
4. **Health verification** - Post-deployment validation
5. **Cleanup** - Maintains last 5 releases for rollback

### Production Commands
```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs booster-beacon-api

# Restart application
pm2 restart booster-beacon-api

# Monitor in real-time
pm2 monit
```

## 🔧 Available Scripts

### Root Level
- `npm run dev` - Start both backend and frontend
- `npm run build` - Build all components
- `npm test` - Run all tests
- `npm run lint` - Lint all code
- `npm run setup` - Complete development setup

### Backend
- `npm run dev:backend` - Start backend in development mode
- `npm run build:backend` - Build backend for production
- `npm run test:backend` - Run backend unit tests
- `npm run test:integration` - Run backend integration tests

### Frontend
- `npm run dev:frontend` - Start frontend development server
- `npm run build:frontend` - Build frontend for production
- `npm run test:frontend` - Run frontend tests

### Extension
- `npm run dev:extension` - Start extension development mode
- `npm run build:extension` - Build extension for production
- `npm run test:extension` - Run extension tests

### Production Deployment
- `npm run deploy:prod` - Deploy to production server
- `npm run deploy:staging` - Deploy to staging environment
- `./scripts/deploy.sh` - Full deployment with health checks
- `./scripts/deploy.sh rollback` - Rollback to previous release

## 🌐 Services

When running locally, services are available at:

- **Backend API**: http://localhost:3000
- **Frontend App**: http://localhost:5173
- **PostgreSQL**: localhost:5434
- **Redis**: localhost:6380

### API Endpoints

#### Core System
- `GET /health` - Health check with uptime and environment info
- `GET /api/v1/status` - API status with version and timestamp

#### Watch Management
- `GET /api/v1/watches` - Get user's watches with filtering and pagination
- `POST /api/v1/watches` - Create a new product watch
- `GET /api/v1/watches/:id` - Get specific watch details
- `PUT /api/v1/watches/:id` - Update watch settings
- `DELETE /api/v1/watches/:id` - Delete a watch
- `PATCH /api/v1/watches/:id/toggle` - Toggle watch active status
- `GET /api/v1/watches/stats` - Get user's watch statistics
- `GET /api/v1/watches/export` - Export watches to CSV
- `POST /api/v1/watches/import` - Bulk import watches from CSV

#### Watch Packs
- `GET /api/v1/watches/packs` - Get available watch packs
- `GET /api/v1/watches/packs/popular` - Get popular watch packs
- `GET /api/v1/watches/packs/:id` - Get watch pack details
- `POST /api/v1/watches/packs/:id/subscribe` - Subscribe to watch pack
- `DELETE /api/v1/watches/packs/:id/subscribe` - Unsubscribe from watch pack
- `GET /api/v1/watches/packs/subscriptions` - Get user's subscriptions

#### Health & Monitoring
- `GET /api/v1/watches/:id/health` - Get watch health status
- `GET /api/v1/watches/health/all` - Get all user watches health
- `GET /api/v1/watches/metrics/performance` - Get watch performance metrics

### Database Schema

Current tables:
- **users** - User accounts with authentication and subscription data
  - UUID primary keys with automatic generation
  - Email uniqueness constraints with indexing
  - bcrypt password hashing
  - Subscription tier management (free/pro)
  - Automatic timestamp tracking

- **watches** - Individual product monitoring subscriptions
  - User-specific product watches with retailer filtering
  - Price thresholds and location-based monitoring
  - Alert preferences and delivery customization
  - Health tracking and performance metrics

- **watch_packs** - Curated collections of related products
  - Pre-configured product bundles (e.g., "Latest Pokémon Sets")
  - Auto-updating collections based on criteria
  - Subscriber management and popularity tracking

- **user_watch_packs** - User subscriptions to watch packs
  - Subscription management with customization options
  - Individual watch creation for pack products
  - Subscription analytics and engagement tracking

- **products** - Pokémon TCG product catalog
  - Product metadata, pricing, and availability
  - UPC codes and retailer-specific information
  - Category classification and search indexing

- **product_categories** - Product classification system
  - Hierarchical category structure
  - Search and filtering optimization

## 🏗️ Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with Helmet.js security
- **Database**: PostgreSQL 15+ with Redis cache
- **Authentication**: JWT tokens with bcrypt
- **Retailer Integration**: Multi-retailer API and scraping with circuit breakers
- **Testing**: Jest with Supertest

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **UI Library**: Tailwind CSS
- **PWA**: Service Worker support
- **Testing**: Jest with React Testing Library

### Infrastructure
- **Containerization**: Docker with Docker Compose
- **Process Management**: PM2 with cluster mode
- **Reverse Proxy**: NGINX
- **Logging**: Winston with structured JSON
- **CI/CD**: GitHub Actions
- **Deployment**: Automated deployment with rollback support

## 🔒 Security

- Helmet.js security headers
- CORS configuration
- JWT token authentication
- bcrypt password hashing
- Input validation with Joi
- Rate limiting
- SQL injection prevention

## 📝 Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/boosterbeacon_dev

# Redis
REDIS_URL=redis://:password@localhost:6379

# JWT
JWT_SECRET=your_secret_key_here

# External Services
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=boosterbeacon-emails

# Twilio SMS
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Discord Integration
DISCORD_BOT_TOKEN=your_discord_token

# Email Configuration
FROM_EMAIL=alerts@boosterbeacon.com
FROM_NAME=BoosterBeacon
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow TypeScript best practices
- Use conventional commit messages
- Ensure all tests pass before submitting PR
- Maintain 90%+ test coverage

## 📋 Project Status

This project is in active development. **Major systems completed:**

- [x] Project foundation and development environment
- [x] Core database schema and models
- [x] Authentication and user management system
- [x] User preferences and settings management
- [x] Product catalog and search functionality
- [x] **Watch management system** ✅ **COMPLETED**
- [x] **Retailer integration and monitoring system** ✅ **COMPLETED**
- [x] **Alert processing and delivery system** ✅ **COMPLETED**
- [ ] Web push notification system **← CURRENT FOCUS**
- [ ] Email notification system with Amazon SES
- [ ] Frontend application
- [ ] Browser extension
- [ ] Machine learning features

### Recent Updates

**Watch Management System** ✨ **MAJOR UPDATE** - Complete watch management system implemented:
- Individual product watches with retailer filtering and price thresholds
- Watch Packs for curated product collections with one-click subscriptions
- CSV import/export for bulk watch management
- Health monitoring and performance metrics
- Advanced filtering, pagination, and search capabilities
- Comprehensive validation and error handling

**Enhanced API Coverage** - 20+ new endpoints for watch and watch pack management
**Robust Testing** - Comprehensive test coverage for all watch management features
**Performance Optimized** - Efficient database queries with pagination and caching
**Admin Features** - System-wide health monitoring and cleanup utilities

**Retailer Integration System** ✨ **MAJOR UPDATE** - Complete retailer monitoring system implemented:
- Multi-retailer support: Best Buy (API), Walmart (API), Costco (scraping), Sam's Club (scraping)
- Circuit breaker pattern for resilient API handling and automatic failure recovery
- Polite scraping with rate limiting and compliance with retailer terms of service
- Comprehensive health monitoring and performance metrics for all retailers
- Advanced error handling with retry logic and exponential backoff
- Rate limiting compliance testing to ensure respectful API usage

**Alert Processing & Delivery System** ✨ **MAJOR UPDATE** - Complete alert system implemented:
- **Multi-channel delivery**: Web Push, Email, SMS (Pro), and Discord (Pro) notifications
- **Intelligent processing**: Deduplication, rate limiting, and spam prevention
- **Smart scheduling**: Quiet hours and user preference filtering
- **Priority-based alerts**: Automatic priority calculation based on product popularity and alert type
- **Retry logic**: Automatic retry with exponential backoff for failed deliveries
- **Rich templates**: HTML emails, Discord embeds, and formatted SMS messages
- **Delivery tracking**: Comprehensive analytics and delivery status monitoring
- **Circuit breaker**: Resilient external service integration with automatic recovery

## 📚 Documentation

- **[Watch Management Guide](docs/watch-management.md)** - Complete guide to the watch management system
- **[Retailer Integration Guide](docs/retailer-integration.md)** - Multi-retailer monitoring system documentation
- **[Alert System Guide](docs/alert-system.md)** - Complete alert processing and delivery system documentation
- **[API Reference](docs/api-reference.md)** - Comprehensive API documentation
- **[Deployment Guide](docs/deployment.md)** - Production deployment instructions
- **[Changelog](docs/CHANGELOG.md)** - Detailed release history and feature updates

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Pokémon TCG community for inspiration
- Open source contributors
- Retailer partners for API access

---

**Made with ❤️ for Pokémon TCG collectors**

For questions or support, please open an issue or contact the development team.