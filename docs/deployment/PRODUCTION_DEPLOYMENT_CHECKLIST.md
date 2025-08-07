# Production Deployment Checklist - Geographic Search Configuration

## ✅ Pre-Deployment Validation

### Code Quality & Standards

- [x] **No linting errors** in modified files
- [x] **Consistent import patterns** across all files
- [x] **Proper error handling** with fallback mechanisms
- [x] **JSDoc documentation** for all exported functions
- [x] **Console logging** for debugging and monitoring

### Configuration Validation

- [x] **searchConfig.js** exports all required functions
- [x] **Service area bounds** use correct coordinate format (WGS84)
- [x] **Fallback to global** configuration when service area not found
- [x] **All service areas** have required properties (name, region, center, searchSettings)
- [x] **Current deployment** set to 'alabama_apco' for production

### Integration Points

- [x] **main.js** imports and uses configuration correctly
- [x] **MapController.js** uses same configuration for consistency
- [x] **Search widget** configuration applied on both ready states
- [x] **Map bounds** and search bounds use same source
- [x] **Home button** configuration handles both bounded and global deployments

## 🚀 Deployment Steps

### 1. Pre-Deployment Testing

```bash
# Run linting
npm run lint

# Test build process
npm run build

# Verify no console errors in development
npm run dev
```

### 2. Configuration Verification

- [ ] **Verify CURRENT_SERVICE_AREA** is set to correct value for deployment
- [ ] **Test search widget** shows local Alabama results first
- [ ] **Test map bounds** constrain navigation to Alabama service area
- [ ] **Test home button** returns to Alabama extent
- [ ] **Check console messages** for configuration confirmations

### 3. Browser Testing Checklist

- [ ] **Desktop Chrome/Edge** - Search and map bounds work correctly
- [ ] **Desktop Firefox** - All functionality operational
- [ ] **Mobile Safari** - Touch interactions and search work
- [ ] **Mobile Chrome** - Performance and functionality verified
- [ ] **Tablet** - Responsive design and search functionality

### 4. Feature Validation

- [ ] **Search widget placeholder** shows "Search addresses, places..."
- [ ] **Local search results** (e.g., "Birmingham" shows Birmingham, AL first)
- [ ] **Address search** within service area returns relevant results
- [ ] **Map navigation** constrained to Alabama bounds
- [ ] **Home button** returns to Alabama service area extent
- [ ] **Theme switching** preserves search configuration

## 🔧 Production Configuration

### Environment-Specific Settings

```javascript
// src/config/searchConfig.js
const CURRENT_SERVICE_AREA = 'alabama_apco'; // ✅ Production setting

// Verify these production values:
bounds: {
  xmin: -88.3319638467807,   // Alabama western boundary
  ymin: 33.440523708494564,  // Alabama southern boundary
  xmax: -87.35488507018964,  // Alabama eastern boundary
  ymax: 34.73445506886154,   // Alabama northern boundary
  spatialReference: { wkid: 4326 }
},
searchSettings: {
  maxResults: 8,
  minCharacters: 3,
  includeDefaultSources: true,
  searchAllEnabled: false,  // ✅ Prefer local results
  placeholder: 'Search addresses, places in Alabama...'
}
```

### HTML Configuration

```html
<!-- index.html - Verify search widget attributes -->
<arcgis-search
  position="top-left"
  theme="light"
  include-default-sources="true"
  max-results="8"
  min-characters="3"
  search-all-enabled="false"
  placeholder="Search addresses, places..."
>
</arcgis-search>
```

## 🔍 Production Monitoring

### Console Messages to Monitor

- ✅ `Search widget configured with Alabama Power Company Service Area bounds for local results preference`
- ✅ `Map constrained to Alabama Power Company Service Area`
- ❌ `Service area 'alabama_apco' not found, falling back to global` (Should NOT appear)
- ❌ `Search widget or map view not available for configuration` (Should NOT appear)

### Performance Metrics

- [ ] **Search response time** < 2 seconds for local queries
- [ ] **Map initialization** with bounds < 3 seconds
- [ ] **No memory leaks** during configuration
- [ ] **Bundle size impact** minimal (<5KB added)

## 🚨 Rollback Plan

If issues are detected in production:

### Immediate Rollback (< 5 minutes)

1. **Revert to previous version** using git
2. **Redeploy previous stable build**
3. **Monitor for restoration** of functionality

### Configuration-Only Rollback (< 2 minutes)

1. **Change CURRENT_SERVICE_AREA** to 'global' in searchConfig.js
2. **Redeploy** (maintains search functionality without bounds)
3. **Investigate** Alabama-specific configuration issues

## 📊 Post-Deployment Validation

### Immediate Checks (0-15 minutes)

- [ ] **Application loads** without console errors
- [ ] **Search widget** appears and accepts input
- [ ] **Map displays** Alabama service area correctly
- [ ] **Basic functionality** (zoom, pan, layers) operational

### Extended Validation (15 minutes - 1 hour)

- [ ] **Search results** show Alabama locations first
- [ ] **User interactions** work across all device types
- [ ] **Performance** meets or exceeds baseline metrics
- [ ] **Error monitoring** shows no new error patterns

### Long-term Monitoring (1-24 hours)

- [ ] **User adoption** of search functionality
- [ ] **Error rates** remain within acceptable thresholds
- [ ] **Performance metrics** stable or improved
- [ ] **User feedback** positive or neutral

## 🔄 Future Deployments

### For Other Geographic Areas

1. **Add new service area** to SERVICE_AREAS object
2. **Update CURRENT_SERVICE_AREA** constant
3. **Test with new bounds** following this checklist
4. **Update placeholder text** for new region
5. **Verify all functionality** with new geographic constraints

### Configuration Management

- **Version control** all configuration changes
- **Document** service area additions in deployment notes
- **Test** configuration changes in staging environment
- **Maintain** backward compatibility with existing deployments

## ✅ Sign-off

- [ ] **Development Team** - Code review and testing complete
- [ ] **QA Team** - Functional testing passed
- [ ] **DevOps Team** - Deployment process validated
- [ ] **Product Owner** - Feature acceptance confirmed
- [ ] **Operations Team** - Monitoring and rollback procedures understood

---

**Deployment Date:** **\*\*\*\***\_**\*\*\*\***
**Deployed By:** ****\*\*****\_****\*\*****
**Approved By:** ****\*\*****\_****\*\*****
