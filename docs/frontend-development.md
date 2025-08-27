# Frontend Development Guide

## Overview

The BoosterBeacon frontend is a modern React 18+ application built with TypeScript, Vite, and Tailwind CSS. It provides a responsive, PWA-enabled interface for Pokémon TCG collectors to manage their product watches and receive real-time alerts.

## Technology Stack

- **React 18+** - Modern React with concurrent features
- **TypeScript** - Full type safety and developer experience
- **Vite** - Lightning-fast development and optimized builds
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing with lazy loading
- **PWA Support** - Service worker and offline capabilities
- **Lucide React** - Beautiful, customizable icons

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page-level components
│   ├── context/        # React Context providers
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API client and external services
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── assets/         # Static assets
├── public/             # Public assets and PWA manifest
└── tests/              # Test files
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Backend API running on port 3000

### Installation
```bash
cd frontend
npm install
```

### Development
```bash
npm run dev
```

The application will be available at http://localhost:5173

## Key Features Implemented

### Authentication System
- Complete login/registration forms
- JWT token management
- Protected routes
- Password strength validation
- Terms acceptance flow

### UI Components
- Responsive layout with mobile-first design
- Pokémon-themed styling
- Loading states and error boundaries
- Optimized performance with memoization

### Product Search System
- Advanced search with real-time filtering
- Debounced input for optimal performance
- Multi-criteria filtering (category, retailer, price)
- Responsive product grid with pagination
- Barcode scanner for mobile PWA
- Watch management integration

### PWA Support
- Service worker for offline functionality
- Installable web app
- Push notification support
- Responsive design for all devices

## Component Architecture

### Product Search Components

#### ProductSearch
Main container component that orchestrates the search experience:
- Manages search state and filters
- Integrates with `useProductSearch` hook
- Handles search form submission and filter toggling
- Renders search header, filters panel, and product grid

#### SearchHeader
Search input and filter controls:
- Debounced search input with loading states
- Filter toggle with active filter indicators
- Clear filters functionality
- Responsive design with mobile optimization

#### SearchFiltersPanel
Advanced filtering interface:
- Category and retailer dropdowns
- Price range inputs with validation
- Sort options with direction control
- In-stock only checkbox filter
- Grid layout responsive to screen size

#### ProductGrid
Product display and pagination:
- Responsive grid layout (1-4 columns based on screen size)
- Loading states and error handling
- Empty state with helpful messaging
- Infinite scroll with load more button
- Product count and pagination info

#### ProductCard
Individual product display:
- Product image with fallback handling
- Pricing with discount indicators
- Availability status overlay
- Watch action buttons
- Retailer count and stock status
- Click handling for product details

### Custom Hooks

#### useProductSearch
Comprehensive search state management:
- Debounced search query handling
- Filter state management
- API integration with error handling
- Pagination and infinite scroll logic
- Active filter detection
- Search result caching

#### useDebounce
Performance optimization for search input:
- Configurable delay (300ms default)
- Prevents excessive API calls
- Smooth user experience during typing

### API Integration

#### apiClient
Centralized API communication:
- Axios-based HTTP client
- JWT token management
- Request/response interceptors
- Error handling and transformation
- Authentication state management

### Type Safety

All components use comprehensive TypeScript interfaces:
- `Product` - Product data structure
- `SearchFilters` - Filter state interface
- `PaginatedResponse<T>` - API response wrapper
- Component prop interfaces for type safety