I'll create a comprehensive project plan file that captures everything we've discussed. This will serve as your foundation
  document for the new repo.

  PROJECT_PLAN.md

  # FiberOMS Insight PWA - Complete Project Plan

  ## Project Overview

  **SaaS Application for ISP Outage Management**
  - Target: Small to medium ISPs
  - Users: Service dispatchers + field technicians
  - Environment: Internet/VPN-only deployments
  - Key Requirement: Mobile-first for field workers on cellular

  ## Architecture Decisions Made

  ### NPM vs CDN Decision
  **CHOSEN: NPM for Production**
  - **Why**: Enterprise reliability, offline capability, VPN-only environments
  - **CDN Issues**: External dependencies, field connectivity problems
  - **Result**: Self-contained application that works anywhere

  ### Technology Stack
  - **Frontend**: Vite + ArcGIS Maps SDK 4.32 + Calcite Components 3.2+
  - **Database**: Supabase
  - **Maps**: ArcGIS JavaScript API (NPM bundled)
  - **UI Framework**: Calcite Design System
  - **PWA**: Service Worker + App Manifest

  ### Mobile Strategy
  **PWA with Mobile-First Design**
  - Single codebase serving all devices
  - Mobile-optimized UI with desktop enhancements
  - Offline capability for field workers
  - App installation on mobile devices

  ## Core Features Scope

  ### Data Layers to Display
  1. **Subscriber Status**
     - Online subscribers (green points)
     - Offline subscribers (red points) - PRIMARY FOCUS

  2. **Fiber Plant Infrastructure**
     - FSA boundaries (polygons)
     - Main line fiber (lines)
     - MST terminals (blue points)
     - Splitters (purple diamonds)
     - Drop fiber (dashed lines)

  3. **Outage Data**
     - Fiber network outages (red polygons)
     - Power company outages (APCo, Tombigbee)

  4. **Vehicle Tracking**
     - Electric vehicles (green triangles)
     - Fiber vehicles (blue triangles)
     - Integration with MyGeotab API

  5. **Environmental**
     - Weather radar overlay (RainViewer API)

  ### Key Functionality
  - **Search**: MFS database integration
  - **Outage Creation**: Sketch tools for creating fiber outage areas
  - **Data Export**: CSV downloads for offline subscribers
  - **Real-time Updates**: Live vehicle tracking and outage status
  - **Theme Support**: Light/dark mode switching

  ## Development Phases

  ### Phase 1: Foundation (Week 1) ✅ READY TO START
  **Goal**: Rock-solid PWA foundation
  - [x] Project setup with NPM dependencies
  - [ ] Basic map with satellite basemap working
  - [ ] Theme toggle functional
  - [ ] Mobile-responsive shell
  - [ ] PWA manifest and service worker
  - [ ] App installs on mobile devices

  **Success Criteria**:
  - Map loads on mobile and desktop
  - Theme switching works
  - PWA installs on phone
  - No console errors

  ### Phase 2: First Data Layer (Week 2)
  **Goal**: Prove data loading pattern works
  - [ ] Environment configuration (.env setup)
  - [ ] Supabase connection established
  - [ ] Demo offline subscribers layer (2-3 points)
  - [ ] Basic popup templates
  - [ ] Layer toggle functionality

  **Success Criteria**:
  - Points appear on map
  - Popups show subscriber info
  - Toggle on/off works
  - Mobile performance good

  ### Phase 3: Core Layer System (Week 3)
  **Goal**: Establish layer management pattern
  - [ ] Layer management system
  - [ ] Online subscribers layer
  - [ ] Layer panel UI (mobile bottom sheet, desktop sidebar)
  - [ ] Layer visibility controls
  - [ ] Basic error handling

  ### Phase 4: Infrastructure Layers (Week 4)
  **Goal**: Add fiber plant visualization
  - [ ] FSA boundaries layer
  - [ ] Main line fiber layer
  - [ ] MST terminals layer
  - [ ] Splitters layer
  - [ ] Drop fiber layer

  ### Phase 5: Search Functionality (Week 5)
  **Goal**: MFS database search integration
  - [ ] Search widget configuration
  - [ ] MFS database connection
  - [ ] Search results display
  - [ ] Mobile-optimized search UI

  ### Phase 6: Outage Management (Week 6)
  **Goal**: Core business functionality
  - [ ] Fiber outage display layer
  - [ ] Sketch tools for outage creation
  - [ ] Outage form modal
  - [ ] Power outage layers (APCo, Tombigbee)

  ### Phase 7: Vehicle Tracking (Week 7)
  **Goal**: Real-time vehicle data
  - [ ] MyGeotab API integration
  - [ ] Electric vehicles layer
  - [ ] Fiber vehicles layer
  - [ ] Real-time update system

  ### Phase 8: Advanced Features (Week 8)
  **Goal**: Polish and optimization
  - [ ] Weather radar overlay
  - [ ] CSV export functionality
  - [ ] Offline data caching
  - [ ] Performance optimization

  ### Phase 9: Production Ready (Week 9)
  **Goal**: Deployment preparation
  - [ ] Error monitoring (Sentry)
  - [ ] Production build optimization
  - [ ] PWA optimization
  - [ ] Security hardening

  ## Key Architecture Patterns

  ### Data Layer Pattern
  ```javascript
  // Each layer follows this pattern:
  async loadLayerName() {
    try {
      const data = await this.dataService.fetchData('table_name');
      if (!data?.length) return;

      const layer = new GeoJSONLayer({
        id: 'layer-id',
        source: data,
        renderer: { /* styling */ },
        popupTemplate: { /* popup config */ }
      });

      this.map.add(layer);
    } catch (error) {
      this.handleLayerError('layer-name', error);
    }
  }

  Mobile-First UI Pattern

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

  PWA Service Worker Pattern

  - Cache critical resources
  - Offline fallback for map tiles
  - Background sync for data updates

  Critical Success Factors

  Performance Requirements

  - Initial load: < 3 seconds on 3G
  - Map interaction: < 100ms response
  - Layer loading: < 2 seconds per layer
  - Offline capability: Core features work without internet

  Mobile Requirements

  - Touch targets: Minimum 44px
  - Readable text: Minimum 16px font size
  - Landscape/portrait: Both orientations supported
  - Installation: PWA install prompt appears

  Enterprise Requirements

  - Security: Works in VPN-only environments
  - Reliability: No external CDN dependencies
  - Deployment: Single build artifact
  - Compliance: No data leakage to external services

  Development Rules

  Code Standards

  - ES2020+ modern JavaScript
  - Mobile-first CSS methodology
  - Component-based architecture
  - Comprehensive error handling
  - Performance monitoring

  Testing Approach

  - Test each phase before moving to next
  - Mobile device testing required
  - Offline functionality testing
  - Performance testing on 3G speeds

  Git Workflow

  - Feature branches for each phase
  - Descriptive commit messages
  - Phase completion tags
  - Clean commit history

  Environment Setup

  Required Environment Variables

  VITE_ARCGIS_API_KEY=your_arcgis_key
  VITE_SUPABASE_URL=your_supabase_url  
  VITE_SUPABASE_ANON_KEY=your_supabase_key
  VITE_GEOTAB_USERNAME=mygeotab_user
  VITE_GEOTAB_PASSWORD=mygeotab_pass
  VITE_GEOTAB_DATABASE=mygeotab_db

  Development Commands

  npm run dev      # Development server
  npm run build    # Production build  
  npm run preview  # Preview production build

  Lessons Learned from Previous Attempt

  What Went Wrong

  - Tried to implement everything at once
  - Mixed CDN and NPM approaches
  - Complex architecture before foundation was solid
  - Too many moving parts simultaneously

  What We'll Do Differently

  - Build systematically: One layer at a time
  - Test thoroughly: Each phase must work before next
  - Mobile-first: Design for worst-case scenarios first
  - NPM-only: Consistent dependency management
  - Simple patterns: Establish patterns early, repeat them

  Success Metrics

  Phase 1 Success

  - Map loads in under 2 seconds
  - Theme toggle works on all devices
  - PWA installs successfully on mobile
  - No console errors
  - Responsive on all screen sizes

  Overall Success

  - All data layers loading correctly
  - Search functionality working
  - Outage creation tools functional
  - Real-time vehicle tracking active
  - Mobile performance excellent
  - PWA fully functional offline
  - Ready for production deployment

  ---
  Next Step: Start Phase 1 with the foundation files provided. Build systematically, test thoroughly, and maintain focus on
  mobile-first PWA approach.

  Create this file in your new repo as `PROJECT_PLAN.md`. It contains everything we discussed and will serve as your roadmap.

  You can reference this document in your new Claude session and continue from Phase 1 with the foundation files I provided
  earlier.

  The key is: **Start with Phase 1, get it perfect, then move to Phase 2.** No skipping ahead! 🚀

╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ >                                                                                                                                    │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ⏵⏵ auto-accept edits on (shift+tab to cycle)                                                    Context left until auto-compact: 32%






