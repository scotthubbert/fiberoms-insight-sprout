# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository. It defines architecture patterns, coding standards, and development practices for the FiberOMS Insight PWA project.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Development Commands](#development-commands)
4. [Project Architecture](#project-architecture)
5. [Core Features & Data Layers](#core-features--data-layers)
6. [Development Phases](#development-phases)
7. [Environment Variables](#environment-variables)
8. [Performance Requirements](#performance-requirements)
9. [SOLID Principles Examples](#solid-principles-examples)
10. [Development Best Practices](#development-best-practices)
11. [Development Philosophy](#development-philosophy)
12. [Common Pitfalls](#common-pitfalls-to-avoid)
13. [Implementation Checklist](#implementation-checklist)
14. [Code Standards](#code-standards)
15. [Security Standards](#security-standards)
16. [Accessibility Requirements](#accessibility-requirements)
17. [Version Control Standards](#version-control-standards)
18. [Documentation Requirements](#documentation-requirements)

## Project Overview

FiberOMS Insight PWA - A production SaaS application for ISP outage management with mobile-first design. This is a Progressive Web App targeted at small to medium ISPs, serving both service dispatchers and field technicians. The application must work in internet/VPN-only deployments with a key requirement of being mobile-first for field workers on cellular connections.

## Technology Stack

- **Frontend**: Vite + ArcGIS Maps SDK 4.32 + Calcite Components 3.2+
- **Database**: Supabase
- **Maps**: ArcGIS JavaScript API (NPM bundled, NOT CDN)
- **UI Framework**: Calcite Design System
- **PWA**: Service Worker + App Manifest
- **Build Tool**: Vite

## Development Commands

```bash
npm run dev      # Development server
npm run build    # Production build  
npm run preview  # Preview production build
```

## Project Architecture

### SOLID Principles for Web Development

This project follows SOLID principles adapted for modern web development:

#### 1. Single Responsibility Principle (SRP)
Each module/component should have one reason to change:
- **Services**: Handle only data fetching/manipulation (e.g., `dataService.js` for Supabase operations)
- **Components**: Focus on single UI concerns (e.g., `SearchBar` only handles search, not data fetching)
- **Utilities**: Perform specific transformations (e.g., `formatters.js` for data formatting)

#### 2. Open/Closed Principle (OCP)
Code should be open for extension but closed for modification:
- Use composition over inheritance
- Leverage CalciteUI component slots and properties for customization
- Create plugin-based layer system for map features

#### 3. Liskov Substitution Principle (LSP)
Components should be replaceable with instances of their subtypes:
- All layer implementations must adhere to the base layer interface
- Service implementations must fulfill their contracts
- Component props should maintain consistent behavior

#### 4. Interface Segregation Principle (ISP)
Clients shouldn't depend on interfaces they don't use:
- Split large services into focused interfaces
- Use specific event handlers instead of monolithic listeners
- Create targeted API endpoints rather than generic ones

#### 5. Dependency Inversion Principle (DIP)
Depend on abstractions, not concretions:
- Inject services as dependencies
- Use configuration objects for layer definitions
- Abstract external APIs behind service interfaces

### Critical Architecture Decision: NPM vs CDN
**Use NPM for all dependencies** - Do NOT use CDN links. This decision was made for:
- Enterprise reliability in VPN-only environments
- Offline capability for field workers
- Self-contained application deployment

### Mobile-First Development Pattern
All CSS and UI decisions should follow mobile-first methodology:
```css
/* Mobile base styles */
.component {
  /* mobile styling */
}

/* Desktop enhancements */
@media (min-width: 769px) {
  .component {
    /* desktop improvements */
  }
}
```

### Code Organization Structure (SOLID-compliant)

```
src/
├── services/           # Single Responsibility: Data & Business Logic
│   ├── base/          # Abstract service interfaces (DIP)
│   │   ├── DataService.js
│   │   └── LayerService.js
│   ├── data/          # Concrete implementations
│   │   ├── SupabaseService.js
│   │   └── GeotabService.js
│   └── layers/        # Layer-specific services
│       ├── SubscriberLayerService.js
│       └── OutageLayerService.js
├── components/        # Single Responsibility: UI Components
│   ├── map/          # Map-related components
│   ├── search/       # Search functionality
│   └── common/       # Reusable UI elements
├── utils/            # Single Responsibility: Pure functions
│   ├── formatters.js
│   └── validators.js
└── config/           # Open/Closed: Configuration over modification
    ├── layers.js     # Layer definitions
    └── services.js   # Service configurations
```

### Data Layer Pattern (SOLID-compliant)
Each map layer follows this consistent pattern adhering to SOLID principles:

```javascript
// Layer Service (SRP - handles only layer logic)
class SubscriberLayerService extends BaseLayerService {
  constructor(dataService) {
    super();
    this.dataService = dataService; // DIP - depends on abstraction
  }

  async createLayer(config) {
    const data = await this.dataService.fetchData(config.table);
    return this.buildLayer(data, config);
  }

  buildLayer(data, config) {
    // OCP - extend through config, not modification
    return new GeoJSONLayer({
      id: config.id,
      source: data,
      renderer: config.renderer,
      popupTemplate: config.popupTemplate
    });
  }
}

// Usage (DIP - inject dependencies)
const layerService = new SubscriberLayerService(dataService);
const layer = await layerService.createLayer(subscriberConfig);
map.add(layer);
```

## Core Features & Data Layers

### Data Layers to Implement
1. **Subscriber Status**: Online (green) and offline (red) points
2. **Fiber Infrastructure**: FSA boundaries, main line fiber, MST terminals, splitters, drop fiber
3. **Outage Data**: Fiber network outages, power company outages (APCo, Tombigbee)
4. **Vehicle Tracking**: Electric and fiber vehicles via MyGeotab API
5. **Environmental**: Weather radar overlay via RainViewer API

### Key Functionality
- MFS database search integration
- Sketch tools for outage creation
- CSV export for offline subscribers
- Real-time updates
- Light/dark theme support

## Development Phases

The project follows a systematic 9-phase approach:
1. **Phase 1**: Foundation (PWA setup, basic map, theme toggle)
2. **Phase 2**: First Data Layer (Supabase connection, demo offline subscribers)
3. **Phase 3**: Core Layer System
4. **Phase 4**: Infrastructure Layers
5. **Phase 5**: Search Functionality
6. **Phase 6**: Outage Management
7. **Phase 7**: Vehicle Tracking
8. **Phase 8**: Advanced Features
9. **Phase 9**: Production Ready

**IMPORTANT**: Complete each phase fully before moving to the next. Do not skip ahead.

## Environment Variables

Required environment variables:
```
VITE_ARCGIS_API_KEY=your_arcgis_key
VITE_SUPABASE_URL=your_supabase_url  
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_GEOTAB_USERNAME=mygeotab_user
VITE_GEOTAB_PASSWORD=mygeotab_pass
VITE_GEOTAB_DATABASE=mygeotab_db
```

## Performance Requirements

- Initial load: < 3 seconds on 3G
- Map interaction: < 100ms response
- Layer loading: < 2 seconds per layer
- Touch targets: Minimum 44px
- Font size: Minimum 16px

## Key References

- **Primary Guide**: https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/build-gis-web-apps-with-javascript-maps-sdk-components
- **ArcGIS Docs**: https://developers.arcgis.com/javascript/latest/
- **Calcite Components**: https://developers.arcgis.com/calcite-design-system/components/
- **CalciteUI Icons**: https://developers.arcgis.com/calcite-design-system/icons/

## SOLID Principles Examples

### 1. Single Responsibility Principle (SRP)
```javascript
// ❌ BAD: Multiple responsibilities
class MapComponent {
  async loadData() { /* fetches from Supabase */ }
  renderLayer() { /* creates map layer */ }
  exportCSV() { /* exports data */ }
  handleTheme() { /* manages theme */ }
}

// ✅ GOOD: Single responsibility per class
class DataService { async fetchData() { /* only data fetching */ } }
class LayerRenderer { render() { /* only rendering */ } }
class CSVExporter { export() { /* only exporting */ } }
class ThemeManager { toggle() { /* only theming */ } }
```

### 2. Open/Closed Principle (OCP)
```javascript
// ✅ GOOD: Extensible through configuration
const layerConfigs = {
  subscriber: {
    renderer: subscriberRenderer,
    popup: subscriberPopup
  },
  outage: {
    renderer: outageRenderer,
    popup: outagePopup
  }
};

// Add new layer types without modifying existing code
layerConfigs.vehicle = { renderer: vehicleRenderer, popup: vehiclePopup };
```

### 3. Liskov Substitution Principle (LSP)
```javascript
// ✅ GOOD: All services implement consistent interface
class BaseDataService {
  async fetch(params) { throw new Error('Must implement'); }
}

class SupabaseService extends BaseDataService {
  async fetch(params) { /* Supabase implementation */ }
}

class GeotabService extends BaseDataService {
  async fetch(params) { /* Geotab implementation */ }
}

// Services are interchangeable
const service = isOffline ? new CachedService() : new SupabaseService();
```

### 4. Interface Segregation Principle (ISP)
```javascript
// ❌ BAD: Fat interface
class DataService {
  fetchSubscribers() {}
  fetchOutages() {}
  fetchVehicles() {}
  updateSubscriber() {}
  deleteOutage() {}
}

// ✅ GOOD: Segregated interfaces
class SubscriberService { fetch() {} update() {} }
class OutageService { fetch() {} create() {} delete() {} }
class VehicleService { fetch() {} track() {} }
```

### 5. Dependency Inversion Principle (DIP)
```javascript
// ✅ GOOD: Depend on abstractions
class MapController {
  constructor(dataService, layerService) {
    this.dataService = dataService;    // Interface, not concrete class
    this.layerService = layerService;  // Interface, not concrete class
  }
}

// Inject dependencies
const mapController = new MapController(
  new SupabaseService(),
  new SubscriberLayerService()
);
```

## Development Best Practices

### CalciteUI Component Verification
Before using any CalciteUI component or icon:

1. **Component Verification**: Check official documentation for component existence and correct properties
2. **Icon Verification**: Use CalciteUI icon browser to verify icon names exist
3. **Event Handling**: Test with standard DOM events first, then check for component-specific events
4. **Property Updates**: Check for deprecated properties in console warnings

### Safe CalciteUI Icons (Guaranteed to Work)
Use these core icons that are always available:
- `circle`, `ellipsis`, `layer`, `users`, `map`, `car`, `apps`
- `search`, `information`, `gear`, `refresh`, `download`
- `polygon`, `line`, `warning`, `flash`

### Console Error Patterns to Watch For
- `calcite [property] is deprecated` → Update to new property name
- `calcite [icon-name] icon failed to load` → Use verified icon name
- `Failed to resolve import` → Verify component exists in CalciteUI

## Development Philosophy

### SOLID-Aligned Development Principles

1. **Component Composition** (SRP + OCP)
   - Build complex features by composing simple, focused components
   - Each component should have a single, well-defined purpose
   - Extend functionality through props and slots, not modification

2. **Service Layer Architecture** (SRP + DIP)
   - Separate data concerns from presentation
   - UI components should never directly access databases
   - Services should be injected, not imported directly

3. **Configuration-Driven Development** (OCP)
   - Use configuration objects to define behavior
   - Avoid hardcoding values in components
   - New features should be addable via config, not code changes

4. **Progressive Enhancement** (LSP)
   - Base functionality should work for all users
   - Enhanced features should gracefully degrade
   - Mobile experience is the baseline, desktop is enhancement

### "Use the Platform" Principle
Always leverage native CalciteUI and ArcGIS components over custom implementations:

✅ **DO**: Use `calcite-segmented-control` for tab navigation
✅ **DO**: Use CalciteUI CSS variables and properties  
✅ **DO**: Rely on built-in component behaviors (theming, accessibility, responsive design)
✅ **DO**: Follow CalciteUI patterns and conventions
✅ **DO**: Use `calcite-list` and `calcite-list-item` for structured data
✅ **DO**: Use standard DOM events (click, change) - not all components have custom events
✅ **DO**: Use `expanded` property instead of deprecated `open`
✅ **DO**: Verify icon names exist in CalciteUI icon library before using

❌ **AVOID**: Custom CSS flexbox/grid layouts when CalciteUI components exist
❌ **AVOID**: Manual button distribution, spacing, or theming
❌ **AVOID**: Reinventing functionality that CalciteUI provides natively
❌ **AVOID**: Fighting against component defaults with complex overrides
❌ **AVOID**: Assuming CalciteUI components exist without verification (e.g., `calcite-input-group`)
❌ **AVOID**: Using deprecated properties (`open` → use `expanded`)
❌ **AVOID**: Guessing icon names - verify they exist in the CalciteUI icon library

**Why**: CalciteUI components are purpose-built, tested, accessible, themeable, and maintainable. Custom implementations create technical debt and compatibility issues.

## Common Pitfalls to Avoid

### Architecture Anti-Patterns
1. **Do NOT use CDN links** - All dependencies must be bundled via NPM
2. **Do NOT implement multiple features simultaneously** - Follow phases sequentially
3. **Do NOT design desktop-first** - Always start with mobile layouts
4. **Do NOT skip testing on actual mobile devices** - Test on real hardware
5. **Do NOT mix architecture patterns** - Use established patterns consistently
6. **Do NOT create custom UI when CalciteUI components exist** - Follow "use the platform" philosophy

### SOLID Violations to Avoid
1. **God Objects** - Classes/modules that do everything (violates SRP)
2. **Hardcoded Dependencies** - Direct imports instead of injection (violates DIP)
3. **Modifying Core Code** - Changing existing code for new features (violates OCP)
4. **Fat Interfaces** - Services with too many methods (violates ISP)
5. **Inconsistent Implementations** - Services that don't fulfill contracts (violates LSP)

## Implementation Checklist

When implementing new features, ensure:
- [ ] Each class/module has a single responsibility
- [ ] New features extend via configuration, not modification
- [ ] Services implement consistent interfaces
- [ ] Dependencies are injected, not hardcoded
- [ ] Interfaces are focused and segregated
- [ ] Mobile experience is implemented first
- [ ] CalciteUI components are used where available
- [ ] Code follows established patterns in the codebase

## Code Standards

### Naming Conventions
- **Files**: Use PascalCase for classes/components (e.g., `MapController.js`, `SearchBar.js`)
- **Variables**: Use camelCase (e.g., `subscriberData`, `layerConfig`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `API_TIMEOUT`)
- **CSS Classes**: Use kebab-case (e.g., `map-container`, `search-input`)

### File Structure Standards
```javascript
// 1. Imports (grouped by type)
import { MapView } from '@arcgis/core/views/MapView.js';  // External
import { DataService } from './services/DataService.js';   // Internal
import { formatDate } from './utils/formatters.js';        // Utilities

// 2. Constants
const MAX_ZOOM = 20;

// 3. Class/Component definition
export class MapController {
  // 4. Constructor with dependency injection
  constructor(dataService, layerService) {
    this.dataService = dataService;
    this.layerService = layerService;
  }
  
  // 5. Public methods
  async initialize() { }
  
  // 6. Private methods (prefixed with _)
  _handleError(error) { }
}
```

### Error Handling Pattern
```javascript
async fetchData() {
  try {
    const data = await this.service.fetch();
    if (!data) {
      console.warn('No data returned');
      return [];
    }
    return data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    // Graceful degradation - don't crash the app
    return [];
  }
}
```

### Testing Requirements
- Test file naming: `ComponentName.test.js` or `ComponentName.spec.js`
- Unit tests for all services and utilities
- Integration tests for critical user flows
- Minimum 80% code coverage for new features

## Security Standards

### Data Handling
- Never expose API keys in client-side code
- Sanitize all user inputs before use
- Use environment variables for sensitive configuration
- Implement proper CORS policies

### Authentication & Authorization
- Use Supabase Row Level Security (RLS)
- Validate permissions on both client and server
- Implement session timeout handling
- Use secure HTTP-only cookies for session management

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance
- All interactive elements must be keyboard accessible
- Provide ARIA labels for map features
- Ensure color contrast ratios meet standards (4.5:1 for normal text)
- Support screen readers with proper semantic HTML
- Provide text alternatives for all visual information

### Mobile Accessibility
- Touch targets minimum 44x44px
- Gestures should have keyboard alternatives
- Avoid relying solely on device orientation
- Ensure readable font sizes (minimum 16px)

## Version Control Standards

### Commit Message Format
```
type(scope): subject

body (optional)

footer (optional)
```

Types: feat, fix, docs, style, refactor, test, chore
Example: `feat(map): add offline subscriber layer`

### Branch Naming
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Hotfixes: `hotfix/description`

## Documentation Requirements

### Code Documentation
- JSDoc comments for all public methods
- Inline comments for complex logic
- README files for each major module
- API documentation for services

### Component Documentation
```javascript
/**
 * Renders subscriber points on the map
 * @param {Object} config - Layer configuration
 * @param {string} config.id - Unique layer identifier
 * @param {Object} config.renderer - Symbol renderer configuration
 * @returns {Promise<Layer>} The created layer instance
 */
async createSubscriberLayer(config) { }
```

## State Management Standards

### Application State
- Use a centralized state management pattern
- Avoid component-level state for shared data
- Implement state persistence for offline capability

### State Structure
```javascript
// Centralized state manager
class AppState {
  constructor() {
    this.layers = new Map();
    this.userPreferences = this.loadPreferences();
    this.connectionStatus = 'online';
  }

  // State updates trigger UI updates
  updateLayer(layerId, data) {
    this.layers.set(layerId, data);
    this.notifyObservers('layer-update', { layerId, data });
  }
}
```

## PWA Requirements

### Service Worker Implementation
- Cache static assets for offline use
- Implement network-first strategy for API calls
- Provide offline fallbacks for critical features
- Show connection status to users

### Manifest Configuration
```json
{
  "name": "FiberOMS Insight",
  "short_name": "FiberOMS",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#007AC2",
  "background_color": "#ffffff"
}
```

### Offline Capabilities
- Store critical data in IndexedDB
- Queue actions for sync when online
- Provide visual indicators for offline mode
- Gracefully handle sync conflicts

## Deployment Standards

### Build Optimization
- Enable tree shaking for unused code
- Implement code splitting for routes
- Optimize images and assets
- Minify CSS and JavaScript

### Production Checklist
- [ ] All environment variables configured
- [ ] Service worker tested on multiple devices
- [ ] Performance metrics meet requirements
- [ ] Security headers configured
- [ ] Error tracking enabled
- [ ] Analytics implemented
- [ ] Backup and recovery tested

## Monitoring and Logging

### Client-Side Logging
```javascript
// Structured logging pattern
class Logger {
  log(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };
    
    // Send to monitoring service in production
    if (this.isProduction) {
      this.sendToMonitoring(entry);
    }
  }
}
```

### Performance Monitoring
- Track page load times
- Monitor API response times
- Track user interactions
- Report errors with context

## Support and Maintenance

### Browser Support
- Chrome/Edge: Latest 2 versions
- Safari: Latest 2 versions
- Firefox: Latest 2 versions
- Mobile browsers: iOS Safari 14+, Chrome Android

### Update Strategy
- Implement version checking
- Notify users of updates
- Force reload for critical updates
- Maintain backward compatibility

## Quick Reference

### Essential Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests
npm run lint         # Lint code
```

### Key Principles
1. **Mobile-First**: Every feature starts with mobile design
2. **SOLID Code**: Follow SOLID principles religiously
3. **CalciteUI First**: Use platform components before custom
4. **Offline Ready**: Design for intermittent connectivity
5. **Performance Critical**: Meet all performance targets

### Contact Points
- Documentation: Internal wiki
- Issue Tracking: GitHub Issues
- Code Reviews: Pull Requests required
- Deployment: CI/CD pipeline

---

*Last Updated: [Auto-update on commit]*
*Version: 1.0.0*