# Hybrid Realtime/Polling Implementation for FiberOMS

This document contains the implementation plan for using Supabase Realtime channels for critical data (offline subscribers) while maintaining polling for large datasets (online subscribers).

## Overview

- **Realtime**: Offline subscribers, vehicles, active outages (small, critical datasets)
- **Polling**: Online subscribers, historical data (large, less critical datasets)

## Implementation Code

### 1. Update the MapApp Constructor

```javascript
class MapApp {
  constructor() {
    // ... existing code ...
    
    // Realtime channels
    this.realtimeChannels = {};
    this.subscriberCache = new Map(); // Cache for efficient updates
    
    // Realtime configuration
    this.realtimeConfig = {
      offlineSubscribers: {
        channel: 'offline-subscribers',
        table: 'mfs',
        filter: 'status=eq.Offline',
        event: '*'
      },
      vehicles: {
        channel: 'vehicle-tracking',
        table: 'vehicles',
        event: '*'
      },
      outages: {
        channel: 'active-outages',
        table: 'outages',
        filter: 'active=eq.true',
        event: '*'
      }
    };
  }
}
```

### 2. Initialize Realtime Subscriptions

```javascript
// Add to MapApp class
async initializeRealtimeSubscriptions() {
  console.log('📡 Initializing realtime subscriptions...');
  
  // Subscribe to offline subscribers changes
  if (this.layerVisibility.offlineSubscribers) {
    this.subscribeToOfflineChanges();
  }
}

subscribeToOfflineChanges() {
  const config = this.realtimeConfig.offlineSubscribers;
  
  // Clean up existing channel if any
  if (this.realtimeChannels.offlineSubscribers) {
    supabase.removeChannel(this.realtimeChannels.offlineSubscribers);
  }
  
  // Create new channel
  const channel = supabase
    .channel(config.channel)
    .on('postgres_changes', {
      event: config.event,
      schema: 'public',
      table: config.table,
      filter: config.filter
    }, (payload) => {
      this.handleOfflineRealtimeUpdate(payload);
    })
    .on('system', { event: 'error' }, (payload) => {
      console.error('❌ Realtime error:', payload);
      // Fallback to polling on error
      this.startPolling('offlineSubscribers');
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to offline subscribers realtime updates');
        // Stop polling since we have realtime
        this.stopPolling('offlineSubscribers');
      }
    });
    
  this.realtimeChannels.offlineSubscribers = channel;
}
```

### 3. Handle Realtime Updates Efficiently

```javascript
// Add to MapApp class
async handleOfflineRealtimeUpdate(payload) {
  console.log('🔄 Realtime update received:', payload.eventType);
  
  if (!this.layers.offlineSubscribers) return;
  
  const { eventType, new: newRecord, old: oldRecord } = payload;
  
  try {
    switch(eventType) {
      case 'INSERT':
        await this.handleOfflineInsert(newRecord);
        break;
        
      case 'UPDATE':
        await this.handleOfflineUpdate(oldRecord, newRecord);
        break;
        
      case 'DELETE':
        await this.handleOfflineDelete(oldRecord);
        break;
    }
  } catch (error) {
    console.error('❌ Error handling realtime update:', error);
  }
}

async handleOfflineInsert(record) {
  // Customer went offline - add to map
  if (record.status === 'Offline' && record.latitude && record.longitude) {
    const graphic = this.createSubscriberGraphic(record);
    
    await this.layers.offlineSubscribers.applyEdits({
      addFeatures: [graphic]
    });
    
    // Cache the graphic for efficient updates
    this.subscriberCache.set(record.id, graphic);
    
    console.log('🔴 Added offline subscriber:', record.customer_name);
  }
}

async handleOfflineUpdate(oldRecord, newRecord) {
  // Handle status changes
  if (oldRecord.status === 'Offline' && newRecord.status !== 'Offline') {
    // Customer came back online - remove from offline layer
    await this.removeOfflineSubscriber(oldRecord.id);
    
    // If online layer is visible, add to it
    if (this.layers.onlineSubscribers && this.layerVisibility.onlineSubscribers) {
      const graphic = this.createSubscriberGraphic(newRecord);
      await this.layers.onlineSubscribers.applyEdits({
        addFeatures: [graphic]
      });
    }
  } else if (oldRecord.status !== 'Offline' && newRecord.status === 'Offline') {
    // Customer went offline - add to offline layer
    await this.handleOfflineInsert(newRecord);
    
    // Remove from online layer if present
    if (this.layers.onlineSubscribers) {
      await this.removeOnlineSubscriber(oldRecord.id);
    }
  } else if (newRecord.status === 'Offline') {
    // Update existing offline subscriber (location change, etc.)
    const cachedGraphic = this.subscriberCache.get(newRecord.id);
    if (cachedGraphic) {
      // Update the graphic
      const updatedGraphic = this.createSubscriberGraphic(newRecord);
      
      await this.layers.offlineSubscribers.applyEdits({
        updateFeatures: [updatedGraphic]
      });
      
      this.subscriberCache.set(newRecord.id, updatedGraphic);
    }
  }
}

async handleOfflineDelete(record) {
  // Remove from offline layer
  await this.removeOfflineSubscriber(record.id);
}

async removeOfflineSubscriber(id) {
  const cachedGraphic = this.subscriberCache.get(id);
  if (cachedGraphic) {
    await this.layers.offlineSubscribers.applyEdits({
      deleteFeatures: [cachedGraphic]
    });
    this.subscriberCache.delete(id);
    console.log('🟢 Removed subscriber from offline layer');
  }
}

createSubscriberGraphic(record) {
  const point = new Point({
    longitude: parseFloat(record.longitude),
    latitude: parseFloat(record.latitude),
    spatialReference: { wkid: 4326 }
  });
  
  return new Graphic({
    geometry: point,
    attributes: {
      ObjectID: record.id,
      customer_name: record.customer_name || record.name,
      customer_number: record.customer_number,
      address: record.address,
      city: record.city,
      state: record.state,
      zip: record.zip,
      phone_number: record.phone_number,
      status: record.status,
      ...record
    }
  });
}
```

### 4. Update Layer Toggle to Manage Realtime

```javascript
// Update toggleLayer method
async toggleLayer(layerName, visible) {
  this.layerVisibility[layerName] = visible;

  // ... existing code ...

  // Manage realtime subscriptions based on visibility
  if (visible && this.realtimeConfig[layerName]) {
    // Start realtime subscription
    if (layerName === 'offlineSubscribers') {
      this.subscribeToOfflineChanges();
    }
    // Add other realtime subscriptions here
  } else if (!visible && this.realtimeChannels[layerName]) {
    // Unsubscribe from realtime
    supabase.removeChannel(this.realtimeChannels[layerName]);
    delete this.realtimeChannels[layerName];
    console.log(`📡 Unsubscribed from ${layerName} realtime updates`);
  }

  // ... rest of existing code ...
}
```

### 5. Cleanup Realtime on Unload

```javascript
// Update cleanup method
cleanup() {
  console.log('🧹 Cleaning up...');
  
  // Stop all polling timers
  Object.keys(this.pollingTimers).forEach(layerName => {
    this.stopPolling(layerName);
  });
  
  // Clean up realtime channels
  Object.keys(this.realtimeChannels).forEach(channelName => {
    supabase.removeChannel(this.realtimeChannels[channelName]);
  });
  
  console.log('✅ Cleanup complete');
}
```

### 6. Handle Connection State

```javascript
// Add connection state handling
initializeConnectionMonitoring() {
  // Monitor connection state
  window.addEventListener('online', () => {
    console.log('🌐 Connection restored');
    // Reinitialize realtime subscriptions
    this.initializeRealtimeSubscriptions();
  });
  
  window.addEventListener('offline', () => {
    console.log('📵 Connection lost');
    // Fallback to polling for critical layers
    if (this.layerVisibility.offlineSubscribers) {
      this.startPolling('offlineSubscribers');
    }
  });
  
  // Periodic connection health check
  setInterval(() => {
    Object.entries(this.realtimeChannels).forEach(([name, channel]) => {
      if (channel.state !== 'joined') {
        console.warn(`⚠️ Realtime channel ${name} disconnected, attempting reconnect...`);
        // Resubscribe
        if (name === 'offlineSubscribers') {
          this.subscribeToOfflineChanges();
        }
      }
    });
  }, 30000); // Check every 30 seconds
}
```

## Usage Notes

1. **Initial Load**: Still fetch all data initially to populate the map
2. **Realtime Updates**: Only for changes after initial load
3. **Fallback**: Automatically falls back to polling if realtime fails
4. **Efficiency**: Caches graphics to avoid querying features for updates
5. **Bi-directional**: Handles customers going offline AND coming back online

## Benefits

- **Instant Updates**: Technicians see outages immediately
- **Efficient**: Only transmits changes, not entire datasets
- **Reliable**: Fallback to polling if connection issues
- **Smart**: Manages subscriptions based on layer visibility

## Future Enhancements

1. Add batching for multiple simultaneous updates
2. Implement optimistic updates for better UX
3. Add notification system for critical offline events
4. Track and display "last updated" timestamp for each layer