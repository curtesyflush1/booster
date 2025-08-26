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

# Run integration tests
npm run test:integration

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend
```

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
- `npm run test:backend` - Run backend tests

### Frontend
- `npm run dev:frontend` - Start frontend development server
- `npm run build:frontend` - Build frontend for production
- `npm run test:frontend` - Run frontend tests

## 🌐 Services

When running locally, services are available at:

- **Backend API**: http://localhost:3000
- **Frontend App**: http://localhost:5173
- **PostgreSQL**: localhost:5434
- **Redis**: localhost:6380

### API Endpoints

- `GET /health` - Health check
- `GET /api/v1/status` - API status
- More endpoints will be added as development progresses

## 🏗️ Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with Helmet.js security
- **Database**: PostgreSQL 15+ with Redis cache
- **Authentication**: JWT tokens with bcrypt
- **Testing**: Jest with Supertest

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **UI Library**: Tailwind CSS
- **PWA**: Service Worker support
- **Testing**: Jest with React Testing Library

### Infrastructure
- **Containerization**: Docker with Docker Compose
- **Reverse Proxy**: NGINX
- **Logging**: Winston with structured JSON
- **CI/CD**: GitHub Actions

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
TWILIO_ACCOUNT_SID=your_twilio_sid
DISCORD_BOT_TOKEN=your_discord_token
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

This project is in active development. Current focus:

- [x] Project foundation and development environment
- [ ] Core database schema and models
- [ ] Authentication and user management
- [ ] Product monitoring system
- [ ] Alert delivery system
- [ ] Frontend application
- [ ] Browser extension
- [ ] Machine learning features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Pokémon TCG community for inspiration
- Open source contributors
- Retailer partners for API access

---

**Made with ❤️ for Pokémon TCG collectors**

For questions or support, please open an issue or contact the development team.