# BoosterBeacon Documentation

Welcome to the BoosterBeacon documentation. This guide covers all aspects of the production-ready, enterprise-grade platform for Pokémon TCG investment and monitoring.

## 📚 Documentation Index

### Getting Started
- [Main README](../README.md) - Project overview, setup, and quick start guide
- [Development Setup](../README.md#development-setup) - Local development environment setup
- [Testing Guide](troubleshooting-tests.md) - Comprehensive testing documentation

### System Architecture

#### **🏗️ Architecture Overview**
- [Architecture Overview](architecture-overview.md) - **UPDATED** Comprehensive guide to BoosterBeacon's production-ready architecture patterns and design decisions

#### **🏗️ Core Architecture Patterns**
- [Repository Pattern Implementation](repository-pattern.md) - Clean data access layer with interface-based dependency injection
- [Alert Processing Strategy Pattern](alert-strategy-pattern.md) - Extensible alert processing with strategy pattern architecture
- [Dependency Injection System](dependency-injection.md) - Complete DI architecture with repository integration
- [Caching System Architecture](caching-system.md) - Multi-tier caching with Redis and intelligent fallback strategies
- [Enhanced Logging System](enhanced-logging.md) - Comprehensive logging with correlation IDs and structured output
- [Frontend Component Architecture](frontend-architecture.md) - Component composition patterns and modern React architecture
- [Type Safety System](type-safety.md) - Runtime type checking and comprehensive validation utilities

#### **📋 System Documentation**
- [API Reference](api-reference.md) - **UPDATED** Complete API endpoint documentation with subscription tiers
- [Database Schema](../README.md#database-schema) - Database structure and relationships
- [Technology Stack](../README.md#technology-stack) - Technical architecture overview

### Core Systems

#### Authentication & Security
- [Authentication Security](authentication-security.md) - JWT tokens, RBAC, and security features
- [Per-User Encryption](per-user-encryption.md) - User-specific encryption for retailer credentials
- [KMS Integration](kms-integration.md) - Enterprise Key Management Service integration
- [Validation System](validation-system.md) - Joi validation standardization and best practices
- [Parameter Sanitization](parameter-sanitization.md) - Input sanitization and security protection
- [Error Logging System](error-logging.md) - Enhanced error logging with correlation IDs and context

#### Performance & Architecture
- [Pagination System](pagination-system.md) - Comprehensive pagination system overview and implementation guide
- [Pagination Enforcement System](../backend/docs/PAGINATION_ENFORCEMENT.md) - Technical implementation details and migration guide
- [Dependency Injection System](../backend/docs/DEPENDENCY_INJECTION.md) - Complete DI architecture and implementation guide

#### Features
- [Watch Management](watch-management.md) - Product monitoring and alert subscriptions
- [Alert System](alert-system.md) - Multi-channel notification system with plan-based filtering
- [ML System](ml-system.md) - **UPDATED** Predictive analytics and machine learning with subscription tiers
- [Email System](email-system.md) - Email delivery and template management
- [SEO System](seo-system.md) - Search engine optimization and sitemap generation
- [Monitoring System](monitoring-system.md) - Health checks, metrics, and alerting

#### User Interfaces
- [User Dashboard](user-dashboard.md) - **UPDATED** User interface with real-time WebSocket updates
- [Admin Dashboard](admin-dashboard.md) - Administrative interface and management tools
- [Browser Extension](browser-extension.md) - Extension features and automated checkout
- [Extension Performance](extension-performance.md) - Service-oriented architecture and performance optimizations
- [Frontend Development](frontend-development.md) - React PWA development guide

#### Integrations
- [Retailer Integration](retailer-integration.md) - **UPDATED** Multi-retailer API with automated catalog ingestion
- [BaseRetailerService Architecture](base-retailer-service.md) - Enhanced base class architecture and refactoring guide
- [Redis Service](redis-service.md) - Caching, token management, and rate limiting

### Development
- [Testing Strategy](testing-strategy.md) - Testing approaches and best practices
- [Deployment Guide](deployment.md) - **UPDATED** Production deployment with Docker and monitoring
- [User Guide](user-guide.md) - End-user documentation

### Recent Updates

#### September 2024 - Production-Ready Platform Release
- **[Architecture Overview](architecture-overview.md)** - **UPDATED** Complete production-ready architecture documentation
- **[API Reference](api-reference.md)** - **UPDATED** Comprehensive API documentation with subscription tiers and ML endpoints
- **[Deployment Guide](deployment.md)** - **UPDATED** Complete deployment guide with Docker, monitoring, and production setup
- **[Main README](../README.md)** - **UPDATED** Production-ready project overview and feature documentation
- **Production-Ready Status** - Enterprise-grade platform with 26+ major systems
- **Subscription-Based Monetization** - Plan-based feature access and resource allocation
- **Real-Time Capabilities** - WebSocket integration and live dashboard
- **ML System Enhancement** - Advanced predictions with top-tier access control
- **Automated Catalog Ingestion** - Intelligent product discovery and normalization
- **Background Service Infrastructure** - Automated availability polling and maintenance
- **Enhanced Monitoring** - Grafana, Prometheus, and comprehensive health checks

#### August 29, 2025 - Browser Extension Performance Optimization
- **[Extension Performance Documentation](extension-performance.md)** - Service-oriented architecture refactoring and performance optimizations
- **Service-Oriented Architecture** - Refactored monolithic background script into specialized services
- **Performance Improvements** - 50-70% CPU reduction, 40-60% memory reduction, 90%+ cache hit rates
- **Chrome Alarms API** - Replaced setInterval for better battery life and performance
- **Intelligent Caching** - TTL-based cache with LRU eviction and automatic cleanup
- **Event Optimization** - Throttling and debouncing for high-frequency events
- **Performance Monitoring** - Comprehensive metrics tracking with threshold-based warnings

#### August 28, 2025 - System Architecture & Performance Improvements
- **[Repository Pattern Implementation](repository-pattern.md)** - Clean data access layer with interface-based dependency injection
- **[Alert Processing Strategy Pattern](alert-strategy-pattern.md)** - Extensible alert processing with strategy pattern architecture
- **[Caching System Architecture](caching-system.md)** - Multi-tier caching with Redis and in-memory fallback
- **[Enhanced Logging System](enhanced-logging.md)** - Comprehensive logging with correlation IDs and structured output
- **[Frontend Component Architecture](frontend-architecture.md)** - Component composition patterns and custom hooks
- **[Type Safety System](type-safety.md)** - Runtime type checking and validation utilities
- **[KMS Integration Documentation](kms-integration.md)** - Enterprise Key Management Service integration
- **[Dependency Injection Documentation](dependency-injection.md)** - Complete DI system implementation guide
- **[Pagination Enforcement Documentation](../backend/docs/PAGINATION_ENFORCEMENT.md)** - Comprehensive pagination system preventing performance issues
- **[Validation System Documentation](validation-system.md)** - Comprehensive guide with Joi standardization
- **[Parameter Sanitization Documentation](parameter-sanitization.md)** - Security protection guide
- **[Token Revocation Documentation](../backend/docs/TOKEN_REVOCATION.md)** - JWT token blacklist system
- **[Enhanced Error Logging Documentation](error-logging.md)** - Comprehensive error handling system
- **[Content Sanitization Documentation](../backend/docs/CONTENT_SANITIZATION.md)** - HTML content sanitization system
- **Dependency Injection Complete** - Full DI system with enhanced testability and maintainability
- **Pagination Enforcement System** - Mandatory pagination preventing performance degradation with large datasets
- **Service Refactoring** - Core services migrated to DI pattern with repository abstraction
- **Joi Migration Complete** - All endpoints now use centralized validation with 90%+ cache hit rate

## 🚀 Production Features

### Core Capabilities
- **Real-Time Monitoring**: Live availability tracking across major retailers
- **ML-Powered Predictions**: Price forecasting, risk assessment, and ROI analysis
- **Subscription-Based Access**: Tiered features with plan-based resource allocation
- **Automated Catalog Ingestion**: Intelligent product discovery and normalization
- **WebSocket Integration**: Real-time updates and live dashboard
- **Background Services**: Automated availability polling and maintenance

### Subscription Tiers
- **Free**: Basic monitoring and alerts
- **Pro**: Enhanced features and ML predictions
- **Premium**: Full access with priority processing

### Technology Stack
- **Backend**: Node.js 18+ with TypeScript, Express.js
- **Frontend**: React 18+ with Vite, TypeScript, Tailwind CSS
- **Database**: PostgreSQL 15+ with Redis caching
- **Authentication**: JWT with bcrypt, RBAC system
- **Real-Time**: WebSocket integration
- **ML**: Advanced prediction algorithms
- **Deployment**: Docker, PM2, Nginx

---

**Last Updated**: September 2025  
**Status**: Production Ready  
**Documentation Version**: 2.0
