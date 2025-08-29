d# BoosterBeacon Documentation

Welcome to the BoosterBeacon documentation. This guide covers all aspects of the collector-grade alerting service for Pokémon TCG collectors.

## 📚 Documentation Index

### Getting Started
- [Main README](../README.md) - Project overview, setup, and quick start guide
- [Development Setup](../README.md#development-setup) - Local development environment setup
- [Testing Guide](troubleshooting-tests.md) - Comprehensive testing documentation

### System Architecture
- [API Reference](api-reference.md) - Complete API endpoint documentation
- [Database Schema](../README.md#database-schema) - Database structure and relationships
- [Technology Stack](../README.md#technology-stack) - Technical architecture overview
- [Dependency Injection System](../backend/docs/DEPENDENCY_INJECTION.md) - **NEW** Complete DI architecture and implementation guide

### Core Systems

#### Authentication & Security
- [Authentication Security](authentication-security.md) - JWT tokens, RBAC, and security features
- [Per-User Encryption](per-user-encryption.md) - **NEW** User-specific encryption for retailer credentials
- [KMS Integration](kms-integration.md) - **NEW** Enterprise Key Management Service integration
- [Validation System](validation-system.md) - **UPDATED** Joi validation standardization and best practices
- [Parameter Sanitization](parameter-sanitization.md) - **NEW** Input sanitization and security protection
- [Error Logging System](error-logging.md) - **NEW** Enhanced error logging with correlation IDs and context

#### Performance & Architecture
- [Pagination System](pagination-system.md) - **NEW** Comprehensive pagination system overview and implementation guide
- [Pagination Enforcement System](../backend/docs/PAGINATION_ENFORCEMENT.md) - **NEW** Technical implementation details and migration guide
- [Dependency Injection System](../backend/docs/DEPENDENCY_INJECTION.md) - **NEW** Complete DI architecture and implementation guide

#### Features
- [Watch Management](watch-management.md) - Product monitoring and alert subscriptions
- [Alert System](alert-system.md) - Multi-channel notification system
- [ML System](ml-system.md) - Predictive analytics and machine learning
- [Email System](email-system.md) - Email delivery and template management
- [SEO System](seo-system.md) - Search engine optimization and sitemap generation
- [Monitoring System](monitoring-system.md) - Health checks, metrics, and alerting

#### User Interfaces
- [User Dashboard](user-dashboard.md) - User interface and dashboard features
- [Admin Dashboard](admin-dashboard.md) - Administrative interface and management tools
- [Browser Extension](browser-extension.md) - Extension features and automated checkout
- [Frontend Development](frontend-development.md) - React PWA development guide

#### Integrations
- [Retailer Integration](retailer-integration.md) - Multi-retailer API and scraping system
- [BaseRetailerService Architecture](base-retailer-service.md) - **NEW** Enhanced base class architecture and refactoring guide
- [Redis Service](redis-service.md) - Caching, token management, and rate limiting

### Development
- [Testing Strategy](testing-strategy.md) - Testing approaches and best practices
- [Deployment Guide](deployment.md) - Production deployment and PM2 configuration
- [User Guide](user-guide.md) - End-user documentation

### Recent Updates

#### August 28, 2025 - System Architecture & Performance Improvements
- **[KMS Integration Documentation](kms-integration.md)** - NEW enterprise Key Management Service integration
- **[Dependency Injection Documentation](../backend/docs/DEPENDENCY_INJECTION.md)** - NEW complete DI system implementation guide
- **[Pagination Enforcement Documentation](../backend/docs/PAGINATION_ENFORCEMENT.md)** - NEW comprehensive pagination system preventing performance issues
- **[Validation System Documentation](validation-system.md)** - UPDATED comprehensive guide with Joi standardization
- **[Parameter Sanitization Documentation](parameter-sanitization.md)** - NEW security protection guide
- **[Token Revocation Documentation](../backend/docs/TOKEN_REVOCATION.md)** - NEW JWT token blacklist system
- **[Enhanced Error Logging Documentation](error-logging.md)** - NEW comprehensive error handling system
- **[Content Sanitization Documentation](../backend/docs/CONTENT_SANITIZATION.md)** - NEW HTML content sanitization system
- **Dependency Injection Complete** - Full DI system with enhanced testability and maintainability
- **Pagination Enforcement System** - Mandatory pagination preventing performance degradation with large datasets
- **Service Refactoring** - Core services migrated to DI pattern with repository abstraction
- **Joi Migration Complete** - All endpoints now use centralized validation with 90%+ cache hit rate
- **Schema Caching** - Performance optimizations implemented across all routes
- **Error Handling** - Standardized validation error responses with correlation IDs
- **Type Safety** - Fixed TypeScript validation issues across all controllers
- **Security Enhancements** - Comprehensive input sanitization middleware deployed
- **BaseRetailerService Refactoring** - Eliminated ~325 lines of duplicate code with enhanced architecture
- **Retailer Integration Improvements** - Standardized behavior, better error handling, and comprehensive testing
- **Email Delivery Improvements** - Enhanced type safety and error handling with performance monitoring
- **Redis Service Enhancements** - Advanced JWT token revocation system with multi-device logout support

#### Previous Updates
- **Authentication Security Enhancements** - JWT token revocation system
- **Email Delivery Improvements** - Type safety and error handling
- **Monitoring System** - Complete health monitoring and alerting
- **SEO Optimization** - Comprehensive SEO and sitemap system
- **Price Comparison** - Cross-retailer price analysis

## 🔍 Quick Navigation

### For Developers
- [KMS Integration](kms-integration.md) - **NEW** Enterprise Key Management Service integration
- [Dependency Injection System](../backend/docs/DEPENDENCY_INJECTION.md) - **NEW** Complete DI architecture and implementation guide
- [Pagination Enforcement System](../backend/docs/PAGINATION_ENFORCEMENT.md) - **NEW** Mandatory pagination system preventing performance issues
- [Validation System](validation-system.md) - **UPDATED** Request validation patterns and Joi standardization
- [Parameter Sanitization](parameter-sanitization.md) - **NEW** Input sanitization and security protection
- [Error Logging System](error-logging.md) - **NEW** Enhanced error logging with correlation IDs and debugging context
- [Token Revocation System](../backend/docs/TOKEN_REVOCATION.md) - **NEW** JWT token blacklist and multi-device logout
- [Content Sanitization System](../backend/docs/CONTENT_SANITIZATION.md) - **NEW** HTML content sanitization with DOMPurify
- [Authentication Security](authentication-security.md) - Security implementation and JWT token management
- [Testing Strategy](testing-strategy.md) - Test coverage and approaches
- [API Reference](api-reference.md) - **UPDATED** Complete endpoint documentation with validation examples

### For System Administrators
- [Deployment Guide](deployment.md) - Production deployment
- [Monitoring System](monitoring-system.md) - Health monitoring and alerts
- [Admin Dashboard](admin-dashboard.md) - Administrative tools

### For End Users
- [User Guide](user-guide.md) - How to use BoosterBeacon
- [User Dashboard](user-dashboard.md) - Dashboard features and navigation
- [Browser Extension](browser-extension.md) - Extension installation and usage

## 🚀 Getting Help

- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/curtesyflush1/booster/issues)
- **Development**: See the [main README](../README.md) for development setup
- **Testing**: Check the [troubleshooting guide](troubleshooting-tests.md) for test issues
- **Deployment**: Follow the [deployment guide](deployment.md) for production setup

## 📈 Project Status

BoosterBeacon is **production ready** with **all 26 major systems completed (100%)**:

- ✅ **KMS Integration System** - Enterprise Key Management Service with multi-provider support (August 28, 2025)
- ✅ **Dependency Injection System** - Complete DI architecture with enhanced testability (August 28, 2025)
- ✅ **Pagination Enforcement System** - Mandatory pagination preventing performance issues (August 28, 2025)
- ✅ **Validation System** - Joi standardization complete with 90%+ cache hit rate (August 28, 2025)
- ✅ **Token Revocation System** - JWT blacklist with Redis and multi-device logout (August 28, 2025)
- ✅ **Enhanced Error Logging** - Comprehensive error context with correlation IDs (August 28, 2025)
- ✅ **Content Sanitization** - HTML sanitization with DOMPurify integration (August 28, 2025)
- ✅ **Email Delivery Improvements** - Type safety and performance monitoring (August 28, 2025)
- ✅ **Authentication & Security** - JWT token revocation system with enterprise-grade security
- ✅ **Watch Management** - Complete product monitoring and alerts system
- ✅ **ML Predictions** - Advanced price forecasting and analytics
- ✅ **Multi-channel Alerts** - Email, SMS, Discord, web push notifications
- ✅ **Browser Extension** - Complete automated checkout assistance
- ✅ **Admin Dashboard** - Comprehensive management tools and analytics
- ✅ **SEO System** - Complete search optimization and sitemaps
- ✅ **Monitoring** - Comprehensive health checks and system metrics
- ✅ **Testing Coverage** - Enhanced test coverage with performance monitoring
- ✅ **Production Readiness** - Complete system integration and deployment ready

**🎯 Status**: **Production Ready** - All systems operational and ready for deployment

See the [main README](../README.md#project-status) for detailed progress tracking.