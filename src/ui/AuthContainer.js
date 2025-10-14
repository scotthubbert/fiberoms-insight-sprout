// AuthContainer.js - Authentication UI component
import { authService } from '../services/AuthService.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('AuthContainer');

/**
 * AuthContainer - Manages the authentication UI
 * Shows sign-in form for unauthenticated users
 */
export class AuthContainer {
  constructor() {
    this.container = null;
    this.signInElement = null;
  }

  /**
   * Initialize the auth container
   */
  async init() {
    try {
      log.info('🎨 Initializing authentication UI...');

      this.container = document.getElementById('auth-container');

      if (!this.container) {
        log.error('❌ Auth container element not found in DOM');
        log.error('Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));

        // Try to create it if it doesn't exist
        this.container = document.createElement('div');
        this.container.id = 'auth-container';
        this.container.className = 'auth-container';
        document.body.insertBefore(this.container, document.body.firstChild);
        log.info('✅ Created auth-container element dynamically');
      }

      // Clear any existing content (like default loading state)
      this.container.innerHTML = '';

      // Create the sign-in container
      this.signInElement = document.createElement('div');
      this.signInElement.id = 'clerk-sign-in-container';
      this.signInElement.className = 'clerk-sign-in-wrapper';

      // Add branding and welcome message
      const welcomeSection = document.createElement('div');
      welcomeSection.className = 'auth-welcome-section';
      welcomeSection.innerHTML = `
        <div class="auth-logo">
          <calcite-icon icon="lock" scale="l"></calcite-icon>
        </div>
        <h1 class="auth-title">FiberOMS Insight</h1>
        <p class="auth-subtitle">Sign in to access the fiber outage map</p>
      `;

      this.container.appendChild(welcomeSection);
      this.container.appendChild(this.signInElement);

      // Mount Clerk sign-in component
      await authService.mountSignIn(this.signInElement);

      log.info('✅ Authentication UI initialized');
    } catch (error) {
      log.error('❌ Failed to initialize authentication UI:', error);

      // Show error message to user
      this.showError('Failed to load sign-in. Please refresh the page.');
    }
  }

  /**
   * Show error message in the auth container
   * @param {string} message - Error message to display
   */
  showError(message) {
    if (!this.container) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'auth-error';
    errorDiv.innerHTML = `
      <calcite-notice kind="danger" open>
        <div slot="title">Authentication Error</div>
        <div slot="message">${message}</div>
      </calcite-notice>
    `;

    this.container.appendChild(errorDiv);
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="auth-loading">
        <calcite-loader scale="l"></calcite-loader>
        <p>Loading authentication...</p>
      </div>
    `;
  }

  /**
   * Clean up the auth container
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.signInElement = null;
  }
}

