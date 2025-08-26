# Technology Stack & Build System

## Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with Helmet.js security middleware
- **Database**: PostgreSQL 15+ (primary), Redis (cache/sessions)
- **Authentication**: JWT tokens with bcrypt password hashing
- **File Storage**: AWS S3 or compatible for uploads/assets
- **Process Management**: PM2 for production deployment

## Frontend Stack
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Tailwind CSS with custom Pokémon-themed components
- **State Management**: React Context API with useReducer
- **PWA**: Service Worker for offline capability and push notifications
- **Real-time**: WebSocket connections for live alerts

## Browser Extension
- **Framework**: Vanilla TypeScript with Web Extensions API
- **Build**: Webpack for cross-browser compatibility (Chrome/Firefox)
- **Storage**: Extension storage APIs for user data
- **Communication**: Message passing with content scripts

## Infrastructure & DevOps
- **Containerization**: Docker with multi-stage builds
- **Development**: Docker Compose for local environment
- **Reverse Proxy**: NGINX for load balancing and SSL termination
- **Logging**: Winston with structured JSON output
- **Testing**: Jest with TypeScript support, Supertest for API testing
- **E2E Testing**: Playwright for browser automation
- **Performance Testing**: Artillery.js for load testing

## External Services
- **Email**: Amazon SES for transactional emails
- **SMS**: Twilio integration for Pro users
- **Push Notifications**: Web Push API with service workers
- **Discord**: Webhook integration for community alerts

## Common Commands

### Development Setup
```bash
# Clone and setup
git clone https://github.com/curtesyflush1/booster
cd booster
npm install

# Start development environment
docker-compose -f docker-compose.dev.yml up -d
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage
```

### Database Management
```bash
# Run migrations
npm run migrate:up
npm run migrate:down

# Seed development data
npm run seed:dev

# Database backup
npm run db:backup
```

### Build & Deploy
```bash
# Build for production
npm run build
npm run build:extension

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod

# Rollback deployment
npm run rollback
```

### Testing Commands
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Security tests
npm run test:security

# Performance tests
npm run test:load
```

## Development Practices
- **Test-Driven Development**: Write tests before or alongside implementation
- **Continuous Testing**: Automated test runs on file changes
- **Code Coverage**: Maintain 90%+ test coverage
- **Security First**: Regular security audits and vulnerability scanning
- **Performance Monitoring**: Track response times and system metrics