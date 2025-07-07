// LoadingIndicator.js - SOLID-compliant loading indicator system
// Single Responsibility: Manages loading state notifications for the application
// Uses Calcite Notice components for non-intrusive user feedback

import '@esri/calcite-components/dist/components/calcite-notice';

/**
 * LoadingIndicator class - Manages loading state notifications
 * Follows SOLID principles:
 * - SRP: Only handles loading state display
 * - OCP: Extensible through configuration
 * - LSP: Consistent interface for all loading types
 * - ISP: Simple, focused interface
 * - DIP: No direct dependencies on specific data services
 */
export class LoadingIndicator {
  constructor() {
    this.container = null;
    this.notices = new Map(); // Track active notices by ID
    this.noticeOrder = []; // Maintain order for stacking
    this.initialized = false;

    // Consolidated loading state
    this.consolidatedNoticeId = 'consolidated-loading';
    this.loadingQueue = new Map(); // Track what's currently loading
    this.useConsolidated = true; // Flag to use consolidated mode
  }

  /**
   * Initialize the loading indicator container
   */
  initialize() {
    if (this.initialized) return;

    // Create container for notices
    this.container = document.createElement('div');
    this.container.className = 'loading-indicator-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');

    // Apply mobile-first responsive positioning
    this.applyContainerStyles();

    document.body.appendChild(this.container);
    this.initialized = true;

    // Handle window resize for responsive positioning
    window.addEventListener('resize', () => this.updateContainerPosition());
  }

  /**
   * Apply mobile-first responsive styles to container
   */
  applyContainerStyles() {
    const styles = `
      .loading-indicator-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
        max-width: 350px;
        width: calc(100% - 40px);
        pointer-events: none;
      }

      .loading-indicator-container calcite-notice {
        pointer-events: all;
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      /* Mobile-first responsive adjustments */
      @media (max-width: 768px) {
        .loading-indicator-container {
          bottom: 10px;
          right: 10px;
          left: 10px;
          width: auto;
          max-width: none;
        }
      }

      /* Adjust for smaller screens */
      @media (max-width: 480px) {
        .loading-indicator-container {
          bottom: 5px;
          right: 5px;
          left: 5px;
        }
      }
    `;

    // Add styles to document if not already present
    if (!document.querySelector('#loading-indicator-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'loading-indicator-styles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }

  /**
   * Update container position based on viewport
   */
  updateContainerPosition() {
    // This method can be extended for more complex positioning logic
    // Currently handled by CSS media queries
  }

  /**
   * Show a loading notice
   * @param {Object} config - Configuration for the notice
   * @param {string} config.id - Unique identifier for the notice
   * @param {string} config.message - Message to display
   * @param {string} config.type - Type of notice (loading, cached, network, error)
   * @param {string} config.dataType - Type of data being loaded (e.g., 'subscribers', 'power-outages')
   * @returns {string} - The notice ID
   */
  show(config) {
    if (!this.initialized) {
      this.initialize();
    }

    const { id, message, type = 'loading', dataType } = config;

    // Remove existing notice with same ID if present
    if (this.notices.has(id)) {
      this.remove(id);
    }

    // Create notice element
    const notice = document.createElement('calcite-notice');
    notice.setAttribute('open', '');
    notice.setAttribute('closable', '');

    // Configure based on type
    const noticeConfig = this.getNoticeConfig(type);
    notice.setAttribute('kind', noticeConfig.kind);
    notice.setAttribute('icon', noticeConfig.icon);

    // Set message with data type context
    const fullMessage = dataType ? `${dataType}: ${message}` : message;
    notice.innerHTML = `
      <div slot="message">${this.escapeHtml(fullMessage)}</div>
    `;

    // Handle close event
    notice.addEventListener('calciteNoticeClose', () => {
      this.remove(id);
    });

    // Add to container and track
    this.container.appendChild(notice);
    this.notices.set(id, notice);
    this.noticeOrder.push(id);

    // Auto-dismiss for success messages
    if (type === 'cached' || type === 'network') {
      setTimeout(() => this.remove(id), 3000);
    }

    return id;
  }

  /**
   * Get notice configuration based on type
   * @param {string} type - Type of notice
   * @returns {Object} - Notice configuration
   */
  getNoticeConfig(type) {
    const configs = {
      loading: {
        kind: 'info',
        icon: 'spinner' // Will show animated spinner
      },
      cached: {
        kind: 'success',
        icon: 'check-circle'
      },
      network: {
        kind: 'info',
        icon: 'download'
      },
      empty: {
        kind: 'success', // Empty is successful completion
        icon: 'circle' // Simple circle for empty datasets
      },
      error: {
        kind: 'danger',
        icon: 'exclamation-mark-triangle'
      }
    };

    return configs[type] || configs.loading;
  }

  /**
   * Update an existing notice
   * @param {string} id - Notice ID to update
   * @param {Object} updates - Updates to apply
   */
  update(id, updates) {
    const notice = this.notices.get(id);
    if (!notice) return;

    if (updates.message) {
      const messageDiv = notice.querySelector('[slot="message"]');
      if (messageDiv) {
        const fullMessage = updates.dataType ?
          `${updates.dataType}: ${updates.message}` :
          updates.message;
        messageDiv.textContent = fullMessage;
      }
    }

    if (updates.type) {
      const config = this.getNoticeConfig(updates.type);
      notice.setAttribute('kind', config.kind);
      notice.setAttribute('icon', config.icon);

      // Auto-dismiss success messages
      if (updates.type === 'cached' || updates.type === 'network') {
        setTimeout(() => this.remove(id), 3000);
      }
    }
  }

  /**
   * Remove a notice
   * @param {string} id - Notice ID to remove
   */
  remove(id) {
    const notice = this.notices.get(id);
    if (!notice) return;

    // Animate out
    notice.style.animation = 'slideOut 0.3s ease-out';

    setTimeout(() => {
      if (notice.parentNode) {
        notice.parentNode.removeChild(notice);
      }
      this.notices.delete(id);
      this.noticeOrder = this.noticeOrder.filter(nId => nId !== id);
    }, 300);
  }

  /**
   * Remove all notices
   */
  clear() {
    this.noticeOrder.forEach(id => this.remove(id));
  }

  /**
   * Update the consolidated loading notice
   */
  updateConsolidatedNotice() {
    if (!this.useConsolidated) return;

    const loadingItems = Array.from(this.loadingQueue.entries());

    if (loadingItems.length === 0) {
      // Remove the consolidated notice if nothing is loading
      this.remove(this.consolidatedNoticeId);
      return;
    }

    // Build message showing what's loading and what's completed
    const loading = loadingItems.filter(([_, status]) => status.type === 'loading');
    const completed = loadingItems.filter(([_, status]) => status.type !== 'loading');

    let message = '';

    if (loading.length > 0) {
      // Show specific loading message with layer names
      if (loading.length === 1) {
        message = `Loading ${loading[0][1].dataType}...`;
      } else {
        // Show specific layer names instead of just count
        const layerNames = loading.map(([_, status]) => status.dataType).join(', ');
        message = `Loading: ${layerNames}`;
      }
    } else if (completed.length > 0) {
      // All loading complete - show summary
      const cached = completed.filter(([_, status]) => status.type === 'cached').length;
      const network = completed.filter(([_, status]) => status.type === 'network').length;
      const empty = completed.filter(([_, status]) => status.type === 'empty').length;
      const errors = completed.filter(([_, status]) => status.type === 'error');

      const parts = [];
      if (cached > 0) parts.push(`${cached} from cache`);
      if (network > 0) parts.push(`${network} from network`);
      if (empty > 0) parts.push(`${empty} empty`);

      // Show specific failed layer names instead of just count
      if (errors.length > 0) {
        if (errors.length === 1) {
          parts.push(`${errors[0][1].dataType} failed`);
        } else {
          const failedLayers = errors.map(([_, status]) => status.dataType).join(', ');
          parts.push(`${errors.length} failed (${failedLayers})`);
        }
      }

      message = `Loaded: ${parts.join(', ')}`;
    }

    // Determine overall type (loading takes precedence, then error, then mixed)
    let type = 'loading';
    if (loading.length === 0) {
      if (loadingItems.some(([_, status]) => status.type === 'error')) {
        type = 'error';
      } else if (loadingItems.every(([_, status]) => status.type === 'cached')) {
        type = 'cached';
      } else {
        type = 'network';
      }
    }

    // Update or create the consolidated notice
    if (this.notices.has(this.consolidatedNoticeId)) {
      this.update(this.consolidatedNoticeId, { message, type });
    } else {
      const noticeId = this.show({
        id: this.consolidatedNoticeId,
        message,
        type
      });
    }

    // Add click handler for error notices to show details (outside the else block)
    if (type === 'error' && completed.length > 0) {
      const errors = completed.filter(([_, status]) => status.type === 'error');
      if (errors.length > 0) {
        const notice = this.notices.get(this.consolidatedNoticeId);
        if (notice) {
          notice.style.cursor = 'pointer';
          notice.title = 'Click to see error details';

          // Remove any existing click handlers
          notice.onclick = null;

          // Add new click handler
          notice.addEventListener('click', () => {
            this.showErrorDetails(errors);
          });
        }
      }
    }

    // Auto-remove completed items after a delay
    if (loading.length === 0) {
      setTimeout(() => {
        this.loadingQueue.clear();
        this.remove(this.consolidatedNoticeId);
      }, 3000);
    }
  }

  /**
   * Show loading state for a specific operation
   * @param {string} operation - Operation identifier
   * @param {string} dataType - Type of data being loaded
   * @returns {string} - Notice ID
   */
  showLoading(operation, dataType) {
    if (this.useConsolidated) {
      this.loadingQueue.set(operation, { type: 'loading', dataType });
      this.updateConsolidatedNotice();
      return this.consolidatedNoticeId;
    }

    return this.show({
      id: `loading-${operation}`,
      message: 'Loading...',
      type: 'loading',
      dataType
    });
  }

  /**
   * Show success state for cached data
   * @param {string} operation - Operation identifier
   * @param {string} dataType - Type of data loaded
   * @returns {string} - Notice ID
   */
  showCached(operation, dataType) {
    if (this.useConsolidated) {
      this.loadingQueue.set(operation, { type: 'cached', dataType });
      this.updateConsolidatedNotice();
      return this.consolidatedNoticeId;
    }

    const id = `loading-${operation}`;
    this.update(id, {
      message: 'Loaded from cache',
      type: 'cached',
      dataType
    });
    return id;
  }

  /**
   * Show success state for network data
   * @param {string} operation - Operation identifier
   * @param {string} dataType - Type of data loaded
   * @returns {string} - Notice ID
   */
  showNetwork(operation, dataType) {
    if (this.useConsolidated) {
      this.loadingQueue.set(operation, { type: 'network', dataType });
      this.updateConsolidatedNotice();
      return this.consolidatedNoticeId;
    }

    const id = `loading-${operation}`;
    this.update(id, {
      message: 'Loaded from network',
      type: 'network',
      dataType
    });
    return id;
  }

  /**
 * Show success state for network data with zero results
 * @param {string} operation - Operation identifier
 * @param {string} dataType - Type of data loaded
 * @returns {string} - Notice ID
 */
  showEmpty(operation, dataType) {
    if (this.useConsolidated) {
      this.loadingQueue.set(operation, { type: 'empty', dataType });
      this.updateConsolidatedNotice();
      return this.consolidatedNoticeId;
    }

    const id = `loading-${operation}`;
    this.update(id, {
      message: 'Loaded (no data)',
      type: 'network', // Treat as successful network load
      dataType
    });
    return id;
  }

  /**
   * Show error state
   * @param {string} operation - Operation identifier
   * @param {string} dataType - Type of data that failed
   * @param {string} errorMessage - Error message
   * @returns {string} - Notice ID
   */
  showError(operation, dataType, errorMessage = 'Failed to load') {
    // Log error to console for immediate debugging visibility
    console.error(`🚨 Loading Error: ${dataType} (${operation}) - ${errorMessage}`);

    if (this.useConsolidated) {
      this.loadingQueue.set(operation, { type: 'error', dataType, errorMessage });
      this.updateConsolidatedNotice();
      return this.consolidatedNoticeId;
    }

    const id = `loading-${operation}`;
    this.update(id, {
      message: errorMessage,
      type: 'error',
      dataType
    });
    return id;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Enable or disable consolidated mode
   * @param {boolean} enabled - Whether to use consolidated mode
   */
  setConsolidatedMode(enabled) {
    this.useConsolidated = enabled;
    if (!enabled) {
      // Clear consolidated state when disabling
      this.loadingQueue.clear();
      this.remove(this.consolidatedNoticeId);
    }
  }

  /**
   * Clear consolidated loading state
   */
  clearConsolidated() {
    this.loadingQueue.clear();
    this.remove(this.consolidatedNoticeId);
  }

  /**
   * Show detailed error information in a separate notice
   * @param {Array} errors - Array of error entries from loading queue
   */
  showErrorDetails(errors) {
    // Remove any existing error details notice
    this.remove('error-details');

    // Build detailed error message
    const errorList = errors.map(([operation, status]) => {
      const errorMsg = status.errorMessage || 'Failed to load';
      return `• ${status.dataType}: ${errorMsg}`;
    }).join('\n');

    const detailMessage = `Loading errors:\n${errorList}`;

    // Create detailed error notice
    const notice = document.createElement('calcite-notice');
    notice.setAttribute('open', '');
    notice.setAttribute('closable', '');
    notice.setAttribute('kind', 'danger');
    notice.setAttribute('icon', 'exclamation-mark-triangle');
    notice.setAttribute('width', 'auto');

    notice.innerHTML = `
      <div slot="title">Loading Error Details</div>
      <div slot="message" style="white-space: pre-line; font-family: monospace; font-size: 12px;">${this.escapeHtml(detailMessage)}</div>
    `;

    // Handle close event
    notice.addEventListener('calciteNoticeClose', () => {
      this.remove('error-details');
    });

    // Add to container and track
    this.container.appendChild(notice);
    this.notices.set('error-details', notice);
    this.noticeOrder.push('error-details');

    // Auto-dismiss after 10 seconds
    setTimeout(() => this.remove('error-details'), 10000);
  }

  /**
   * Destroy the loading indicator
   */
  destroy() {
    this.clear();
    this.loadingQueue.clear();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.initialized = false;
  }
}

// Create singleton instance
export const loadingIndicator = new LoadingIndicator();