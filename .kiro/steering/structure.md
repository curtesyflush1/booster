# Project Structure & Organization

## Repository Structure
```
booster/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── controllers/     # Route handlers and business logic
│   │   ├── models/          # Database models and schemas
│   │   ├── services/        # Core business services
│   │   ├── middleware/      # Express middleware (auth, validation, etc.)
│   │   ├── routes/          # API route definitions
│   │   ├── utils/           # Utility functions and helpers
│   │   ├── config/          # Configuration management
│   │   └── types/           # TypeScript type definitions
│   ├── tests/               # Backend test suites
│   ├── migrations/          # Database migration files
│   ├── seeds/               # Database seed data
│   └── docker/              # Backend-specific Docker files
├── frontend/                # React PWA application
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Page-level components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── context/         # React Context providers
│   │   ├── services/        # API client and external services
│   │   ├── utils/           # Frontend utility functions
│   │   ├── types/           # TypeScript interfaces
│   │   └── assets/          # Static assets (images, icons)
│   ├── public/              # Public assets and PWA manifest
│   └── tests/               # Frontend test suites
├── extension/               # Browser extension
│   ├── src/
│   │   ├── background/      # Background script logic
│   │   ├── content/         # Content scripts for retailer sites
│   │   ├── popup/           # Extension popup UI
│   │   ├── options/         # Extension options page
│   │   └── shared/          # Shared utilities and types
│   ├── manifest/            # Browser-specific manifests
│   └── tests/               # Extension test suites
├── shared/                  # Shared code between components
│   ├── types/               # Common TypeScript definitions
│   ├── utils/               # Shared utility functions
│   └── constants/           # Application constants
├── docs/                    # Project documentation
├── scripts/                 # Build and deployment scripts
├── docker-compose.dev.yml   # Development environment
├── docker-compose.prod.yml  # Production environment
└── .github/                 # GitHub Actions workflows
```

## Key Architectural Patterns

### Backend Services Organization
- **Controllers**: Handle HTTP requests, validation, and response formatting
- **Services**: Contain core business logic and external API integrations
- **Models**: Database entities with validation and relationships
- **Middleware**: Cross-cutting concerns (authentication, logging, rate limiting)

### Frontend Component Structure
- **Pages**: Top-level route components that compose smaller components
- **Components**: Reusable UI components following atomic design principles
- **Hooks**: Custom hooks for state management and side effects
- **Context**: Global state management for authentication and user preferences

### Shared Code Strategy
- **Types**: Common interfaces shared between frontend and backend
- **Utils**: Pure functions used across multiple components
- **Constants**: Application-wide constants and configuration values

## Naming Conventions

### Files and Directories
- **kebab-case** for directories: `user-management/`, `alert-processing/`
- **PascalCase** for React components: `AlertCard.tsx`, `UserProfile.tsx`
- **camelCase** for utilities and services: `emailService.ts`, `validateInput.ts`
- **UPPER_SNAKE_CASE** for constants: `API_ENDPOINTS.ts`, `ERROR_CODES.ts`

### Code Conventions
- **Interfaces**: Prefix with `I` for clarity: `IUser`, `IAlert`, `IProduct`
- **Types**: Descriptive names: `AlertType`, `UserRole`, `ProductCategory`
- **Enums**: PascalCase with descriptive values: `AlertStatus.PENDING`
- **Functions**: Verb-noun pattern: `getUserById()`, `sendAlert()`, `validateEmail()`

## Database Schema Organization
- **Users**: Authentication, profiles, preferences, subscription data
- **Products**: Pokémon TCG product catalog with metadata
- **Watches**: User subscriptions to product availability monitoring
- **Alerts**: Generated notifications with delivery status
- **Retailers**: Supported retailer configurations and health status
- **Analytics**: User engagement and system performance metrics

## Testing Structure
- **Unit Tests**: Co-located with source files using `.test.ts` suffix
- **Integration Tests**: Separate `tests/integration/` directory
- **E2E Tests**: `tests/e2e/` with page object model pattern
- **Test Data**: Shared fixtures in `tests/fixtures/` directory

## Configuration Management
- **Environment Variables**: `.env` files for different environments
- **Config Objects**: Centralized configuration in `config/` directories
- **Secrets**: Secure credential storage using environment-specific methods
- **Feature Flags**: Runtime configuration for gradual feature rollouts

## Development Workflow
- **Feature Branches**: `feature/alert-system`, `feature/user-dashboard`
- **Commit Messages**: Conventional commits format for automated changelog
- **Pull Requests**: Required reviews before merging to main branch
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Code Length**: Keep individual files under 500 lines when possible for better maintainability

## Security Considerations
- **Input Validation**: Centralized validation middleware and schemas
- **Authentication**: JWT tokens with secure storage and rotation
- **Authorization**: Role-based access control throughout the application
- **Data Encryption**: Sensitive data encrypted at rest and in transit
- **Rate Limiting**: API endpoint protection against abuse