# ADR: SOLID Refactoring of Monolithic Main.js

**Date**: 2024-12-19  
**Status**: Accepted  
**Author**: Development Team  
**Supersedes**: N/A  
**Superseded by**: N/A

## Context

The FiberOMS Insight PWA had grown to a monolithic 3,834-line `main.js` file that contained all application logic including map initialization, data fetching, layer management, popup handling, theme switching, and PWA functionality. This created several problems:

- **Maintainability**: Difficult to locate and modify specific functionality
- **Testing**: Nearly impossible to unit test individual components
- **Code Reuse**: Logic was tightly coupled and not reusable
- **Collaboration**: Multiple developers couldn't work on different features simultaneously
- **Bug Isolation**: Issues in one area could affect seemingly unrelated functionality
- **Performance**: Entire application logic loaded upfront regardless of what features were needed

## Decision

Refactor the monolithic `main.js` into a service-oriented architecture following SOLID principles:

- **Single Responsibility Principle**: Each service handles one specific concern
- **Open/Closed Principle**: Services are open for extension but closed for modification
- **Liskov Substitution Principle**: Services can be replaced with compatible implementations
- **Interface Segregation Principle**: Services expose only necessary methods
- **Dependency Inversion Principle**: Services depend on abstractions, not concrete implementations

The new architecture includes:

- `MapController.js` - Map initialization and core map operations
- `LayerManager.js` - Layer creation, management, and configuration
- `PopupManager.js` - Popup display and interaction handling
- `ThemeManager.js` - UI theme switching and persistence
- `PWAManager.js` - Progressive Web App functionality
- `dataService.js` - Data fetching and caching from Supabase

## Consequences

### Positive Consequences

- **Improved Maintainability**: Each service has a clear, single responsibility
- **Enhanced Testability**: Individual services can be unit tested in isolation
- **Better Code Organization**: Related functionality grouped logically
- **Easier Collaboration**: Developers can work on different services simultaneously
- **Reduced Coupling**: Services communicate through well-defined interfaces
- **Performance Benefits**: Services can be lazy-loaded when needed
- **Bug Isolation**: Issues are contained within specific services
- **Code Reusability**: Services can be reused across different parts of the application

### Negative Consequences

- **Initial Complexity**: More files and structure to understand initially
- **Over-Engineering Risk**: Could lead to unnecessary abstraction for simple operations
- **Integration Complexity**: Services must be properly integrated and coordinated

### Risks and Mitigations

- **Risk**: Breaking existing functionality during refactoring
  - **Mitigation**: Incremental refactoring with thorough testing at each step
- **Risk**: Performance overhead from service abstraction
  - **Mitigation**: Profile performance and optimize service interactions
- **Risk**: Inconsistent service interfaces
  - **Mitigation**: Establish clear service contracts and documentation standards

## Alternatives Considered

### Alternative 1: Incremental Function Extraction

- **Description**: Gradually extract functions from main.js without full service architecture
- **Pros**: Lower risk, easier to implement incrementally
- **Cons**: Doesn't solve fundamental architecture issues, still tightly coupled
- **Rejection Reason**: Wouldn't provide long-term maintainability benefits

### Alternative 2: Complete Framework Migration

- **Description**: Migrate to a full framework like React or Vue with component architecture
- **Pros**: Modern tooling, established patterns, large ecosystem
- **Cons**: Complete rewrite required, learning curve, framework lock-in
- **Rejection Reason**: Too disruptive for current project timeline and team

### Alternative 3: Module Pattern with Namespaces

- **Description**: Use JavaScript module pattern with namespaced objects
- **Pros**: Simpler than full service architecture, better organization than monolith
- **Cons**: Still lacks clear separation of concerns, testing difficulties
- **Rejection Reason**: Doesn't provide sufficient improvement over current state

## Implementation Plan

### Phase 1: Service Creation

- Extract MapController with core map functionality
- Create LayerManager for layer-specific operations
- Implement basic service communication patterns

### Phase 2: Data and UI Services

- Refactor data fetching into dedicated dataService
- Create ThemeManager for UI theme handling
- Implement PopupManager for user interactions

### Phase 3: PWA and Integration

- Extract PWA functionality into PWAManager
- Integrate all services in refactored main.js
- Comprehensive testing and optimization

## Success Criteria

- [✓] Reduced main.js from 3,834 lines to under 200 lines
- [✓] Each service has a single, clear responsibility
- [✓] All existing functionality preserved and working
- [✓] Services can be individually tested
- [✓] New features can be added without modifying existing services
- [✓] Application startup time maintained or improved

## Review Date

**Review Date**: 2025-03-19 (3 months post-implementation)

## Related Decisions

- Feature documentation standards (this documentation structure)
- Service communication patterns
- Testing strategy for service architecture

## References

- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Martin Fowler - Refactoring](https://refactoring.com/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Original Refactoring Summary](../../REFACTORING_SUMMARY.md)
