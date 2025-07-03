# FiberOMS Insight PWA

A Progressive Web App (PWA) for ISP outage management with real-time subscriber status monitoring, power outage integration, and mobile-first design.

## 🚀 Recent Improvements

### Enhanced Caching System (v1.0.0)

- **Improved Service Worker Strategy**: Changed from aggressive caching to `StaleWhileRevalidate` for better updates
- **Cache Control Headers**: Added proper HTTP cache control headers for Cloudflare Pages deployment
- **Version-Based Cache Invalidation**: Application cache now includes version checking to prevent stale data
- **Update Notifications**: Users will be notified when app updates are available
- **Developer Tools**: Added `Ctrl+Shift+R` / `Cmd+Shift+R` shortcut to clear all caches in development

### Cache Management Features

- **Automatic Cache Cleanup**: Old cache versions are automatically removed
- **Shorter Cache Times**: Reduced external resource caching from 30 days to 7 days
- **Network-First for APIs**: Supabase API calls now use Network-First strategy for fresher data
- **Manual Cache Clear**: Users can force refresh data when needed

## 📱 Features

- **Real-time Subscriber Monitoring**: Track online/offline subscribers with live updates
- **Power Outage Integration**: APCo and Tombigbee Electric outage data with visual indicators
- **Mobile-First Design**: Responsive interface optimized for field technicians
- **Offline Capability**: Works offline with cached data and background sync
- **Progressive Web App**: Installable on mobile devices and desktop
- **Advanced Search**: Search subscribers by address, account, or customer details
- **Weather Integration**: RainViewer radar overlay for weather-related outages
- **Vehicle Tracking**: Track fleet locations (Electric and Fiber vehicles)

## 🛠️ Technical Stack

- **Framework**: Vanilla JavaScript with ArcGIS Maps SDK
- **UI Components**: Calcite Design System (Esri)
- **Mapping**: ArcGIS Maps SDK for JavaScript
- **Backend**: Supabase (PostgreSQL + Real-time subscriptions)
- **Build Tool**: Vite with PWA plugin
- **Deployment**: Cloudflare Pages

## 🎯 Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Environment Setup

Copy `.env.example` to `.env` and configure:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ARCGIS_API_KEY=your_arcgis_api_key
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clear all caches (development)
# Press Ctrl+Shift+R (or Cmd+Shift+R) in browser
```

## 🔧 Cache Management

### For Developers

- **Cache Clear Shortcut**: `Ctrl+Shift+R` / `Cmd+Shift+R` clears all caches
- **Console Logging**: All cache operations are logged to browser console
- **Version Checking**: Cache includes version stamps to prevent stale data

### For Deployment

- **Cloudflare Headers**: `public/_headers` file configures cache control
- **Service Worker**: Automatically updates when new version is deployed
- **Update Notifications**: Users see toast notifications for available updates

## 📊 Performance

- **Load Time**: ~3.5MB gzipped (15MB uncompressed)
- **Cache Strategy**: StaleWhileRevalidate for optimal performance
- **Offline Support**: Full functionality available offline
- **Update Speed**: Incremental updates with background sync

## 🔐 Security

- **API Key Protection**: Environment variables for sensitive data
- **CORS Configuration**: Proper CORS setup for Supabase
- **Content Security**: Source maps disabled in production
- **Cache Security**: No sensitive data in browser cache

## 📈 Monitoring

- **Real-time Updates**: Supabase real-time subscriptions
- **Error Handling**: Comprehensive error logging
- **Performance Metrics**: Built-in performance monitoring
- **Update Tracking**: Version-based deployment tracking

## 🚀 Deployment

### Cloudflare Pages

1. Connect repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set build output: `dist`
4. Configure environment variables
5. Deploy automatically on push to main

### Cache Configuration

- HTML/JS files: Short cache with revalidation
- Static assets: Longer cache with version checking
- Service worker: No cache for immediate updates
- API responses: Network-first with short cache

## 🐛 Troubleshooting

### Cache Issues

- **Stale Data**: Press `Ctrl+Shift+R` to clear all caches
- **Update Not Loading**: Check console for service worker errors
- **Slow Loading**: Verify network connectivity and cache headers

### Common Issues

- **Map Not Loading**: Verify ArcGIS API key in environment variables
- **Data Not Updating**: Check Supabase connection and cache settings
- **PWA Not Installing**: Ensure HTTPS and valid manifest.json

## 📝 Documentation

- [Feature Documentation](docs/features/)
- [Deployment Guide](docs/deployment/)
- [Architecture Decisions](docs/adr/)
- [API Reference](docs/api/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including cache behavior)
5. Submit a pull request

## 📄 License

This project is proprietary software developed for FiberOMS operations.
