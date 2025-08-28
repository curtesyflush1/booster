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

### Core Systems

#### Authentication & Security
- [Authentication Security](authentication-security.md) - JWT tokens, RBAC, and security features
- [Validation System](validation-system.md) - **UPDATED** Joi validation standardization and best practices
- [Parameter Sanitization](parameter-sanitization.md) - **NEW** Input sanitization and security protection
- [Error Logging System](error-logging.md) - **NEW** Enhanced error logging with correlation IDs and context

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

#### August 28, 2025 - Validation System Standardization & Retailer Refactoring
- **[Validation System Documentation](validation-system.md)** - UPDATED comprehensive guide
- **[Parameter Sanitization Documentation](parameter-sanitization.md)** - NEW security protection guide
- **Joi Migration Complete** - All endpoints now use centralized validation with 90%+ cache hit rate
- **Schema Caching** - Performance optimizations implemented across all routes
- **Error Handling** - Standardized validation error responses with correlation IDs
- **Type Safety** - Fixed TypeScript validation issues across all controllers
- **Security Enhancements** - Comprehensive input sanitization middleware deployed
- **BaseRetailerService Refactoring** - Eliminated ~325 lines of duplicate code with enhanced architecture
- **Retailer Integration Improvements** - Standardized behavior, better error handling, and comprehensive testing

#### Previous Updates
- **Authentication Security Enhancements** - JWT token revocation system
- **Email Delivery Improvements** - Type safety and error handling
- **Monitoring System** - Complete health monitoring and alerting
- **SEO Optimization** - Comprehensive SEO and sitemap system
- **Price Comparison** - Cross-retailer price analysis

## 🔍 Quick Navigation

### For Developers
- [Validation System](validation-system.md) - **UPDATED** Request validation patterns and Joi standardization
- [Parameter Sanitization](parameter-sanitization.md) - **NEW** Input sanitization and security protection
- [Error Logging System](error-logging.md) - **NEW** Enhanced error logging with correlation IDs and debugging context
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

BoosterBeacon is in active development with **24 of 26 major systems completed**:

- ✅ **Validation System** - Joi standardization complete (August 28, 2025)
- ✅ **Authentication & Security** - JWT token revocation system
- ✅ **Watch Management** - Product monitoring and alerts
- ✅ **ML Predictions** - Price forecasting and analytics
- ✅ **Multi-channel Alerts** - Email, SMS, Discord, web push
- ✅ **Browser Extension** - Automated checkout assistance
- ✅ **Admin Dashboard** - Management tools and analytics
- ✅ **SEO System** - Search optimization and sitemaps
- ✅ **Monitoring** - Health checks and system metrics
- 🔄 **Testing Coverage** - Improving to 90%+ coverage
- 🔄 **Production Readiness** - Final integration and optimization

See the [main README](../README.md#project-status) for detailed progress tracking.