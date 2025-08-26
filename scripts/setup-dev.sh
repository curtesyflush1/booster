#!/bin/bash

# BoosterBeacon Development Environment Setup Script

set -e

echo "🚀 Setting up BoosterBeacon development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Copy environment files if they don't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your actual configuration values"
fi

if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env file from template..."
    cp backend/.env.example backend/.env
fi

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U booster_user -d boosterbeacon_dev; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
until docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping; do
    echo "Waiting for Redis..."
    sleep 2
done

echo "✅ All services are ready!"

# Run database migrations
echo "🗄️  Running database migrations..."
cd backend && npm run migrate:up && cd ..

# Seed development data
echo "🌱 Seeding development data..."
cd backend && npm run seed:dev && cd ..

# Run initial tests
echo "🧪 Running initial tests..."
cd backend && npm test && cd ..

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "To start development:"
echo "  npm run dev              # Start both backend and frontend"
echo "  npm run dev:backend      # Start only backend"
echo "  npm run docker:dev:logs  # View Docker logs"
echo ""
echo "Useful commands:"
echo "  npm test                 # Run all tests"
echo "  npm run test:watch       # Run tests in watch mode"
echo "  npm run docker:dev:down  # Stop Docker services"
echo ""
echo "Services running at:"
echo "  Backend API: http://localhost:3000"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6380"
echo ""