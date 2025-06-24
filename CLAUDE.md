# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Data Layer Pattern
Each map layer follows this consistent pattern:
```javascript
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

## Development Philosophy

### "Use the Platform" Principle
Always leverage native CalciteUI and ArcGIS components over custom implementations:

✅ **DO**: Use `calcite-segmented-control` for tab navigation
✅ **DO**: Use CalciteUI CSS variables and properties  
✅ **DO**: Rely on built-in component behaviors (theming, accessibility, responsive design)
✅ **DO**: Follow CalciteUI patterns and conventions

❌ **AVOID**: Custom CSS flexbox/grid layouts when CalciteUI components exist
❌ **AVOID**: Manual button distribution, spacing, or theming
❌ **AVOID**: Reinventing functionality that CalciteUI provides natively
❌ **AVOID**: Fighting against component defaults with complex overrides

**Why**: CalciteUI components are purpose-built, tested, accessible, themeable, and maintainable. Custom implementations create technical debt and compatibility issues.

## Common Pitfalls to Avoid

1. **Do NOT use CDN links** - All dependencies must be bundled via NPM
2. **Do NOT implement multiple features simultaneously** - Follow phases sequentially
3. **Do NOT design desktop-first** - Always start with mobile layouts
4. **Do NOT skip testing on actual mobile devices** - Test on real hardware
5. **Do NOT mix architecture patterns** - Use established patterns consistently
6. **Do NOT create custom UI when CalciteUI components exist** - Follow "use the platform" philosophy