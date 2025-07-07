# Truck Tracking Implementation Guide

## Overview

The FiberOMS Insight PWA includes real-time vehicle tracking capabilities for both fiber installation trucks and electric maintenance vehicles. This document explains the implementation and how to configure it for production use.

## Current Implementation

### Mock Mode (Default)

The application currently runs in **mock mode** by default, which displays sample truck data to demonstrate the functionality without requiring actual MyGeotab credentials. This is suitable for:

- Development and testing
- Demonstrations to stakeholders
- UI/UX development and refinement

### Features Included

✅ **Real-time visualization** - Trucks appear as triangular markers on the map  
✅ **Vehicle-specific styling** - Blue triangles for fiber trucks, green for electric trucks  
✅ **Direction indication** - Triangles rotate based on vehicle bearing  
✅ **Status visualization** - Size and opacity change based on driving/stopped state  
✅ **Detailed popups** - Click any truck to see vehicle details  
✅ **Layer controls** - Toggle truck layers on/off independently  
✅ **Mobile support** - Full functionality on mobile devices

## Mock Data Details

The mock implementation includes:

- **2 Fiber Trucks** - Located in Birmingham and Montgomery areas
- **2 Electric Trucks** - Located in Huntsville and Mobile areas
- **Realistic statuses** - Mix of moving/stopped vehicles with appropriate speeds
- **Connection status** - Some vehicles show as offline to demonstrate error handling

## Production Implementation

### Requirements

For production MyGeotab integration, you'll need:

1. **MyGeotab Account** with API access
2. **Server-side proxy** (Node.js/Express recommended)
3. **Environment configuration** for credentials
4. **CORS handling** for browser security

### Why Server-Side Proxy is Required

MyGeotab API integration requires a server-side proxy because:

- **CORS Restrictions**: MyGeotab API doesn't allow direct browser requests
- **Security**: API credentials should never be exposed to client-side code
- **Rate Limiting**: Server can implement proper request throttling
- **Error Handling**: Better error recovery and logging capabilities

### Server-Side Implementation

#### 1. Create Express API Endpoint

```javascript
// server/routes/geotab.js
const express = require("express");
const GeotabApi = require("mg-api-js");
const router = express.Router();

// Initialize GeotabApi
const api = new GeotabApi(
  {
    credentials: {
      database: process.env.GEOTAB_DATABASE,
      userName: process.env.GEOTAB_USERNAME,
      password: process.env.GEOTAB_PASSWORD,
    },
  },
  {
    rememberMe: false,
    timeout: 30,
  }
);

// Authenticate and get truck data
router.get("/trucks", async (req, res) => {
  try {
    // Authenticate if needed
    if (!api.authenticated) {
      await api.authenticate();
    }

    // Get devices and status in parallel
    const [devices, statusData] = await Promise.all([
      api.call("Get", { typeName: "Device" }),
      api.call("Get", { typeName: "DeviceStatusInfo" }),
    ]);

    // Process and categorize vehicles
    const processedData = processVehicleData(devices, statusData);

    res.json(processedData);
  } catch (error) {
    console.error("GeotabService API error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle data" });
  }
});

function processVehicleData(devices, statusData) {
  // Implementation similar to GeotabService.getTruckData()
  // ... processing logic here
}

module.exports = router;
```

#### 2. Update Client-Side Service

```javascript
// src/services/GeotabService.js (production version)
export class GeotabService {
  async getTruckData() {
    if (this.config.mockMode) {
      return getMockTruckData();
    }

    try {
      // Call your server-side API endpoint
      const response = await fetch("/api/geotab/trucks", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${your_auth_token}`, // If using auth
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch truck data:", error);

      // Fallback to mock data if server is unavailable
      if (this.config.fallbackToSupabase) {
        console.warn("Using mock data as fallback");
        return getMockTruckData();
      }

      throw error;
    }
  }
}
```

### Environment Configuration

#### Server-Side (.env)

```env
# MyGeotab Credentials (Server-side only)
GEOTAB_USERNAME=your-geotab-username
GEOTAB_PASSWORD=your-geotab-password
GEOTAB_DATABASE=your-geotab-database
GEOTAB_TIMEOUT=30000
```

#### Client-Side (.env)

```env
# Client-side configuration
VITE_GEOTAB_ENABLED=true
VITE_GEOTAB_MOCK_MODE=false
VITE_GEOTAB_REFRESH_INTERVAL=30000
VITE_API_BASE_URL=https://your-server.com/api
```

### Deployment Steps

1. **Set up server-side API** with GeotabService integration
2. **Deploy backend** with proper environment variables
3. **Update client configuration** to point to your API
4. **Set VITE_GEOTAB_MOCK_MODE=false** in production
5. **Test real-time data flow** with actual vehicles

### Security Considerations

- **Never expose MyGeotab credentials** in client-side code
- **Use HTTPS** for all API communications
- **Implement rate limiting** on your server endpoints
- **Add authentication** to your truck data API
- **Log security events** for monitoring

### Testing Strategy

1. **Mock Mode Testing**: Develop and test UI with mock data
2. **Server Integration**: Test server-side API independently
3. **End-to-End Testing**: Verify complete data flow
4. **Load Testing**: Ensure system handles multiple concurrent users
5. **Failover Testing**: Verify fallback mechanisms work correctly

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your server includes proper CORS headers
2. **Authentication Failures**: Verify MyGeotab credentials and database name
3. **Rate Limiting**: Implement appropriate request throttling
4. **Data Format Issues**: Ensure your server returns data in expected format

### Debug Mode

Enable debug logging by setting:

```env
VITE_GEOTAB_MOCK_MODE=true
DEBUG=geotab:*
```

### Monitoring

Implement monitoring for:

- **API Response Times**: Track MyGeotab API performance
- **Error Rates**: Monitor authentication and data fetch failures
- **Data Freshness**: Ensure vehicle positions are updating
- **Connection Status**: Track online/offline vehicle states

## Future Enhancements

- **Historical Tracking**: Store and display vehicle route history
- **Geofencing**: Alert when vehicles enter/exit specific areas
- **Maintenance Scheduling**: Integration with vehicle maintenance systems
- **Driver Communication**: Two-way messaging with field crews
- **Performance Analytics**: Analyze routing efficiency and fuel consumption

## Support

For implementation assistance:

1. Review MyGeotab API documentation
2. Test with mock data first
3. Implement server-side proxy gradually
4. Contact MyGeotab support for API issues
5. Use browser developer tools for debugging client-side issues
