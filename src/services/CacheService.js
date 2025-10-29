// CacheService.js - Handles local caching of large, infrequently changing data
import Dexie from 'dexie';
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('CacheService');

class CacheService {
  constructor() {
    log.info('🚀 Initializing CacheService...');

    // Initialize IndexedDB using Dexie
    this.db = new Dexie('FiberOMSCache');

    // Define database schema
    this.db.version(1).stores({
      ospData: 'id, dataType, timestamp, data',
      metadata: 'key, value'
    });

    // Open the database
    this.db.open().then(() => {
      log.info('✅ IndexedDB (FiberOMSCache) opened successfully');
    }).catch(err => {
      log.error('❌ Failed to open IndexedDB:', err);
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
      log.info(`🔍 Looking for cached data: ${dataType}`);
      const cachedEntry = await this.db.ospData.get(dataType);

      if (!cachedEntry) {
        log.info(`❌ No cached entry found for ${dataType}`);
        return null;
      }

      log.info(`📦 Found cached ${dataType}, checking validity...`);
      log.info(`   Timestamp: ${new Date(cachedEntry.timestamp).toISOString()}`);
      log.info(`   Age: ${this.getAgeString(cachedEntry.timestamp)}`);

      if (this.isCacheValid(cachedEntry.timestamp, dataType)) {
        log.info(`✅ Cache is valid, returning ${dataType} data`);
        return cachedEntry.data;
      } else {
        log.info(`⏰ Cache expired for ${dataType}`);
        return null;
      }
    } catch (error) {
      log.error('Error reading from cache:', error);
      return null;
    }
  }

  // Store OSP data in cache
  async setCachedData(dataType, data) {
    try {
      log.info(`💾 Attempting to cache ${dataType} data...`);
      const entry = {
        id: dataType,
        dataType: dataType,
        timestamp: Date.now(),
        data: data
      };

      await this.db.ospData.put(entry);

      log.info(`✅ Successfully cached ${dataType} data:`);
      log.info(`   Features: ${this.getDataSize(data)}`);
      log.info(`   Timestamp: ${new Date(entry.timestamp).toISOString()}`);

      // Verify it was stored
      const verify = await this.db.ospData.get(dataType);
      if (verify) {
        log.info(`✅ Verified ${dataType} is in IndexedDB`);
      } else {
        log.error(`❌ Failed to verify ${dataType} in IndexedDB`);
      }
    } catch (error) {
      log.error('Error writing to cache:', error);
      log.error('Entry that failed:', { dataType, dataSize: this.getDataSize(data) });
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
          log.info(`🗑️ Cleared expired cache for ${entry.dataType}`);
        }
      }
    } catch (error) {
      log.error('Error clearing expired cache:', error);
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
      log.error('Error getting cache stats:', error);
      return [];
    }
  }

  // Clear all cache
  async clearAllCache() {
    try {
      await this.db.ospData.clear();
      log.info('🗑️ Cleared all OSP cache');
    } catch (error) {
      log.error('Error clearing cache:', error);
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

  // Check storage quota and clear old cache if needed
  async checkQuota() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();
        const percentUsed = (usage / quota) * 100;
        
        log.info(`💾 Storage usage: ${(usage / 1024 / 1024).toFixed(2)}MB / ${(quota / 1024 / 1024).toFixed(2)}MB (${percentUsed.toFixed(1)}%)`);
        
        // Clear expired cache if usage is high
        if (percentUsed > 80) {
          log.warn(`⚠️ Storage ${percentUsed.toFixed(1)}% full, clearing expired cache...`);
          await this.clearExpiredCache();
          
          // Check again after cleanup
          const { usage: newUsage } = await navigator.storage.estimate();
          const newPercentUsed = (newUsage / quota) * 100;
          log.info(`✅ Storage after cleanup: ${newPercentUsed.toFixed(1)}% full`);
          
          // If still over 90%, clear all cache
          if (newPercentUsed > 90) {
            log.warn(`🚨 Storage critically full (${newPercentUsed.toFixed(1)}%), clearing all cache...`);
            await this.clearAllCache();
          }
        }
        
        return { usage, quota, percentUsed };
      }
      
      return null;
    } catch (error) {
      log.error('❌ Error checking storage quota:', error);
      return null;
    }
  }

  // Start periodic quota monitoring
  startQuotaMonitoring(intervalMs = 300000) { // Default 5 minutes for battery efficiency
    // Check quota immediately
    this.checkQuota();
    
    // Then check periodically
    this._quotaCheckInterval = setInterval(() => {
      this.checkQuota();
    }, intervalMs);
    
    log.info(`🔄 Started storage quota monitoring (interval: ${intervalMs / 1000 / 60}min)`);
  }

  // Stop quota monitoring
  stopQuotaMonitoring() {
    if (this._quotaCheckInterval) {
      clearInterval(this._quotaCheckInterval);
      this._quotaCheckInterval = null;
      log.info('🛑 Stopped storage quota monitoring');
    }
  }
}

// Create singleton instance
export const cacheService = new CacheService();

// Start quota monitoring automatically after a short delay
if (typeof window !== 'undefined') {
  setTimeout(() => {
    cacheService.startQuotaMonitoring();
  }, 5000); // Start after 5 seconds
}
