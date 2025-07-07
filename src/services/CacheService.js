// CacheService.js - Handles local caching of large, infrequently changing data
import Dexie from 'dexie';

class CacheService {
  constructor() {
    console.log('🚀 Initializing CacheService...');
    
    // Initialize IndexedDB using Dexie
    this.db = new Dexie('FiberOMSCache');
    
    // Define database schema
    this.db.version(1).stores({
      ospData: 'id, dataType, timestamp, data',
      metadata: 'key, value'
    });
    
    // Open the database
    this.db.open().then(() => {
      console.log('✅ IndexedDB (FiberOMSCache) opened successfully');
    }).catch(err => {
      console.error('❌ Failed to open IndexedDB:', err);
    });
    
    // Cache expiration times (in milliseconds)
    // OSP data changes very infrequently (once per year), so use long cache times
    this.CACHE_DURATION = {
      fsa: 90 * 24 * 60 * 60 * 1000,        // 90 days for FSA boundaries
      mainFiber: 90 * 24 * 60 * 60 * 1000,  // 90 days for main fiber
      mainOld: 365 * 24 * 60 * 60 * 1000,   // 365 days for old main line (never changes)
      mstFiber: 90 * 24 * 60 * 60 * 1000,   // 90 days for MST fiber
      mstTerminals: 30 * 24 * 60 * 60 * 1000, // 30 days for terminals
      closures: 30 * 24 * 60 * 60 * 1000,   // 30 days for closures
      splitters: 30 * 24 * 60 * 60 * 1000,  // 30 days for splitters
      nodeSites: 90 * 24 * 60 * 60 * 1000   // 90 days for node sites
    };
  }

  // Check if cached data is still valid
  isCacheValid(timestamp, dataType) {
    if (!timestamp) return false;
    
    const now = Date.now();
    const age = now - timestamp;
    const maxAge = this.CACHE_DURATION[dataType] || 24 * 60 * 60 * 1000; // Default 24 hours
    
    return age < maxAge;
  }

  // Get cached OSP data
  async getCachedData(dataType) {
    try {
      console.log(`🔍 Looking for cached data: ${dataType}`);
      const cachedEntry = await this.db.ospData.get(dataType);
      
      if (!cachedEntry) {
        console.log(`❌ No cached entry found for ${dataType}`);
        return null;
      }
      
      console.log(`📦 Found cached ${dataType}, checking validity...`);
      console.log(`   Timestamp: ${new Date(cachedEntry.timestamp).toISOString()}`);
      console.log(`   Age: ${this.getAgeString(cachedEntry.timestamp)}`);
      
      if (this.isCacheValid(cachedEntry.timestamp, dataType)) {
        console.log(`✅ Cache is valid, returning ${dataType} data`);
        return cachedEntry.data;
      } else {
        console.log(`⏰ Cache expired for ${dataType}`);
        return null;
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  // Store OSP data in cache
  async setCachedData(dataType, data) {
    try {
      console.log(`💾 Attempting to cache ${dataType} data...`);
      const entry = {
        id: dataType,
        dataType: dataType,
        timestamp: Date.now(),
        data: data
      };
      
      await this.db.ospData.put(entry);
      
      console.log(`✅ Successfully cached ${dataType} data:`);
      console.log(`   Features: ${this.getDataSize(data)}`);
      console.log(`   Timestamp: ${new Date(entry.timestamp).toISOString()}`);
      
      // Verify it was stored
      const verify = await this.db.ospData.get(dataType);
      if (verify) {
        console.log(`✅ Verified ${dataType} is in IndexedDB`);
      } else {
        console.error(`❌ Failed to verify ${dataType} in IndexedDB`);
      }
    } catch (error) {
      console.error('Error writing to cache:', error);
      console.error('Entry that failed:', { dataType, dataSize: this.getDataSize(data) });
    }
  }

  // Clear expired cache entries
  async clearExpiredCache() {
    try {
      const allEntries = await this.db.ospData.toArray();
      const now = Date.now();
      
      for (const entry of allEntries) {
        if (!this.isCacheValid(entry.timestamp, entry.dataType)) {
          await this.db.ospData.delete(entry.id);
          console.log(`🗑️ Cleared expired cache for ${entry.dataType}`);
        }
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const entries = await this.db.ospData.toArray();
      const stats = entries.map(entry => ({
        dataType: entry.dataType,
        timestamp: entry.timestamp,
        age: this.getAgeString(entry.timestamp),
        size: this.getDataSize(entry.data),
        expires: this.getExpirationString(entry.timestamp, entry.dataType)
      }));
      
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return [];
    }
  }

  // Clear all cache
  async clearAllCache() {
    try {
      await this.db.ospData.clear();
      console.log('🗑️ Cleared all OSP cache');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Helper functions
  getAgeString(timestamp) {
    const age = Date.now() - timestamp;
    const hours = Math.floor(age / (60 * 60 * 1000));
    
    if (hours < 1) {
      const minutes = Math.floor(age / (60 * 1000));
      return `${minutes} minutes`;
    } else if (hours < 24) {
      return `${hours} hours`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} days`;
    }
  }

  getExpirationString(timestamp, dataType) {
    const maxAge = this.CACHE_DURATION[dataType] || 24 * 60 * 60 * 1000;
    const expiresAt = timestamp + maxAge;
    const timeUntilExpiration = expiresAt - Date.now();
    
    if (timeUntilExpiration <= 0) {
      return 'Expired';
    }
    
    return `Expires in ${this.getAgeString(Date.now() - (Date.now() - timeUntilExpiration))}`;
  }

  getDataSize(data) {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (data.features) return data.features.length;
    return 1;
  }

  // Check if we should use cache (e.g., on slow connection)
  shouldUseCache() {
    // Check connection type if available
    if ('connection' in navigator) {
      const connection = navigator.connection;
      // Use cache on slow connections
      if (connection.effectiveType === 'slow-2g' || 
          connection.effectiveType === '2g' ||
          connection.saveData) {
        return true;
      }
    }
    
    // Always try cache first on mobile devices
    return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
}

// Create singleton instance
export const cacheService = new CacheService();