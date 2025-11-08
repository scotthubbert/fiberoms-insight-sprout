// noticeContainer.js - Shared utility for notice container management
// Single source of truth for #notice-container creation and access

/**
 * Get or create the shared notice container
 * Ensures all notifications use the same container for consistent positioning
 * @returns {HTMLElement} The #notice-container element
 */
export function getOrCreateNoticeContainer() {
  let container = document.querySelector('#notice-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'notice-container';
    // Positioning is handled by CSS - no inline styles needed
    document.body.appendChild(container);
  }
  
  return container;
}

/**
 * Remove the notice container if it's empty
 * Called after notices are removed to clean up the DOM
 */
export function removeNoticeContainerIfEmpty() {
  const container = document.querySelector('#notice-container');
  if (container && container.children.length === 0) {
    container.remove();
  }
}

