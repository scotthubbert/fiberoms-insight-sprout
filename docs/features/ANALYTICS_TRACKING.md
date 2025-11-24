# Analytics & Click Tracking Guide

## Overview

This document explains how to track user clicks and interactions in the FiberOMS Insight PWA. We use a **hybrid approach**:
- **Sentry**: Error tracking and performance monitoring
- **PostHog**: User behavior analytics and click tracking

This gives you the best of both worlds - comprehensive error visibility AND detailed user behavior insights.

## Current Implementation: Sentry Click Tracking

### ✅ What Sentry CAN Do

1. **Track Custom Events** - Log clicks as custom events
2. **Session Replay** - Watch recorded user sessions (requires paid plan)
3. **Custom Tags** - Add searchable metadata to events
4. **User Identification** - Link events to specific users

### ❌ What Sentry CANNOT Do Well

1. **Aggregated Analytics Dashboards** - No built-in "most clicked sections" reports
2. **Easy Data Export** - Requires API calls or manual export
3. **Real-time Analytics** - Not designed for product analytics
4. **Cost Efficiency** - Custom events count toward error quotas (can be expensive)
5. **Heatmaps** - No visual click heatmaps
6. **Funnel Analysis** - No built-in funnel tracking

## How to Use Sentry Click Tracking

### Basic Usage

```javascript
import { trackClick, trackEvent } from './services/SentryService.js';

// Track a button click
button.addEventListener('click', () => {
  trackClick('export-csv-button', {
    section: 'dashboard',
    itemCount: data.length
  });
});

// Track a custom event
trackEvent('layer_toggled', {
  layerName: 'power-outages',
  enabled: true,
  section: 'layers-panel'
});
```

### Where to Add Tracking

#### 1. Navigation Actions (LayerPanel.js)

Track which sections users visit most:

```javascript
// In LayerPanel.js setupActionBarNavigation()
action.addEventListener('click', (event) => {
  trackClick(actionId, {
    section: 'navigation',
    action: contentMap[actionId]
  });
  // ... existing code
});
```

#### 2. Export Buttons (DashboardManager.js)

Track export usage:

```javascript
// In DashboardManager.js
async refreshDashboard() {
  trackClick('refresh-dashboard', {
    section: 'header',
    action: 'refresh'
  });
  // ... existing code
}
```

#### 3. Layer Toggles (LayerManager.js)

Track which layers are used most:

```javascript
// When toggling a layer
trackEvent('layer_toggled', {
  layerName: layerId,
  enabled: isEnabled,
  section: 'layers-panel'
});
```

#### 4. Search Usage (HeaderSearch.js)

Track search patterns:

```javascript
// When search is performed
trackEvent('search_performed', {
  queryLength: query.length,
  resultCount: results.length,
  section: 'header-search'
});
```

#### 5. Mobile Tab Bar (MobileTabBar.js)

Track mobile navigation:

```javascript
// When tab is selected
trackClick(`mobile-tab-${tabId}`, {
  section: 'mobile-navigation',
  tab: tabId
});
```

## Getting Analytics from Sentry

### Option 1: Sentry Dashboard (Limited)

1. Go to your Sentry project
2. Navigate to **Issues** → Filter by `event_type:user_click`
3. Manually count events (not ideal for aggregated stats)

### Option 2: Sentry API (Better)

Export events via Sentry API:

```bash
# Get your auth token from Sentry settings
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://sentry.io/api/0/organizations/ORG/projects/PROJECT/events/?query=event_type:user_click"
```

Then analyze the JSON data yourself.

### Option 3: Sentry Insights (Paid Feature)

If you have a paid Sentry plan, you can use Insights to create custom queries, but it's still not as robust as dedicated analytics tools.

## PostHog Analytics (Implemented ✅)

PostHog is now **fully integrated** for user behavior analytics and click tracking.

### Features

- ✅ **Automatic click tracking** (autocapture enabled)
- ✅ **Built-in dashboards** for "most clicked sections"
- ✅ **Session replay** (optional, can be enabled)
- ✅ **User identification** with Clerk auth
- ✅ **Custom event tracking** throughout the app
- ✅ **Free tier**: 1M events/month

### Setup Instructions

**Step 1: Sign Up & Get API Key** (Do this FIRST)

1. Go to [posthog.com](https://posthog.com) and sign up (free account)
2. Create a new project
3. You'll be taken to the installation page - **copy your Project API Key** from there
   - It looks like: `phc_a2uD2wO3MaDp0q9N4H5MeXxoHCtLYcxCM75NqiM22zb`
   - You can also find it later in **Project Settings** → **Project API Key**

**Step 2: Configure Environment Variables**

Add to your `.env` file (or `.env.local` for local development):
```bash
VITE_POSTHOG_ENABLED=true
VITE_POSTHOG_KEY=phc_your_actual_api_key_here
VITE_POSTHOG_HOST=https://us.i.posthog.com  # Optional, defaults to US region
```

**Note:** The API host depends on your PostHog region:
- US: `https://us.i.posthog.com` (default)
- EU: `https://eu.i.posthog.com`
- Check your project settings in PostHog dashboard for the correct host

**Step 3: Verify Installation**

1. Start your app: `npm run dev`
2. Open your app in the browser
3. Click around and interact with the app
4. Go to your PostHog dashboard → **Activity** → **Live events**
5. You should see events appearing in real-time!

**Step 4: View Analytics**

- **Live Events**: **Activity** → **Live events** - See events as they happen
- **Most Clicked Sections**: **Insights** → **Trends** - Filter by `user_click` event
- **Session Replay**: **Recordings** - Watch user sessions (if enabled)
- **Custom Dashboards**: Create your own dashboards for key metrics

### What's Being Tracked

The following interactions are automatically tracked:

1. **Navigation Clicks** (`LayerPanel.js`)
   - Which sections users visit most (Subscribers, OSP, Vehicles, Power Outages, etc.)
   - Navigation patterns

2. **Search Events** (`HeaderSearch.js`)
   - Search queries and result counts
   - Search success/failure rates
   - Search source (header, desktop, mobile)

3. **Layer Toggles** (`LayerManager.js`)
   - Which layers are enabled/disabled most
   - Layer usage patterns

4. **Export Actions** (`Application.js`)
   - CSV export usage (offline, all, TA5K reports)
   - Export success/failure rates
   - Item counts exported

5. **Dashboard Refresh** (`DashboardManager.js`)
   - Manual refresh frequency
   - Refresh patterns

6. **User Authentication**
   - Sign-in events
   - Sign-out events
   - User identification for session tracking

### Custom Tracking Functions

The `AnalyticsService.js` provides these functions:

```javascript
import { 
  trackClick, 
  trackEvent, 
  trackSearch, 
  trackLayerToggle, 
  trackExport,
  trackFeatureUsage 
} from './services/AnalyticsService.js';

// Track a click
trackClick('button-id', { section: 'dashboard' });

// Track a custom event
trackEvent('custom_event_name', { property: 'value' });

// Track search
trackSearch('search query', resultCount, { source: 'header' });

// Track layer toggle
trackLayerToggle('layer-id', true, { layer_type: 'graphics' });

// Track export
trackExport('csv', { item_count: 100, success: true });

// Track feature usage
trackFeatureUsage('feature_name', { context: 'value' });
```

### Viewing Analytics in PostHog

#### Most Clicked Sections

1. Go to **Insights** → **Trends**
2. Select event: `user_click`
3. Group by property: `element` or `section`
4. See which sections/elements are clicked most

#### Search Analytics

1. Go to **Insights** → **Trends**
2. Select event: `search_performed`
3. View:
   - Average query length
   - Result counts
   - Success rates
   - Search sources

#### Layer Usage

1. Go to **Insights** → **Trends**
2. Select event: `layer_toggled`
3. Filter by `layer_name` to see which layers are used most
4. See enable/disable patterns

#### Export Analytics

1. Go to **Insights** → **Trends**
2. Select event: `export_performed`
3. View:
   - Export types used
   - Success rates
   - Average item counts

### Privacy & GDPR

- PostHog respects Do Not Track headers
- Input fields are masked by default
- Can self-host for full data control
- User data is anonymized by default

## Current Implementation: Hybrid Approach ✅

We use **both** Sentry and PostHog:

- **Sentry**: Error tracking and performance monitoring
- **PostHog**: User behavior analytics and click tracking

This gives you:
- ✅ Complete error visibility (Sentry)
- ✅ Complete user behavior visibility (PostHog)
- ✅ Best of both worlds

## Privacy Considerations

- **Sentry**: Data stored on Sentry servers (can self-host)
- **PostHog**: Can self-host for full privacy control
- Both support GDPR compliance
- Consider user consent for analytics in EU regions

## Implementation Status

✅ **PostHog**: Fully integrated and tracking
✅ **Sentry**: Error tracking active
✅ **User Identification**: Linked to Clerk auth
✅ **Key Interactions**: All major user actions tracked

## Next Steps

1. **Configure PostHog**: Add your API key to environment variables
2. **View Analytics**: Check PostHog dashboard for insights
3. **Create Dashboards**: Build custom dashboards for your key metrics
4. **Optional**: Enable session replay for deeper insights
5. **Optional**: Self-host PostHog for full data control (if needed)

## Example: Tracking Implementation

See `src/services/SentryService.js` for the tracking functions:
- `trackClick()` - Track button/element clicks
- `trackEvent()` - Track custom events
- `identifyUser()` - Link events to users

## Questions?

- For Sentry: Check [Sentry Docs](https://docs.sentry.io/)
- For PostHog: Check [PostHog Docs](https://posthog.com/docs)
- For implementation: See examples in this codebase

