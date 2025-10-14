// AuthService.js - Clerk authentication management service
import { Clerk } from '@clerk/clerk-js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('AuthService');

/**
 * AuthService - Manages Clerk authentication
 * Handles initialization, sign-in, sign-out, and session management
 */
class AuthService {
    constructor() {
        this.clerk = null;
        this.isInitialized = false;
        this.isAuthenticated = false;
        this.user = null;
        this.publishableKey = 'pk_test_aHVtb3JvdXMtYmFzaWxpc2stNzIuY2xlcmsuYWNjb3VudHMuZGV2JA';
    }

    /**
     * Initialize Clerk and load the session
     * @returns {Promise<boolean>} True if user is authenticated
     */
    async initialize() {
        try {
            log.info('🔐 Initializing Clerk authentication...');

            // Initialize Clerk
            this.clerk = new Clerk(this.publishableKey);
            await this.clerk.load();

            this.isInitialized = true;

            // Check if user is signed in
            if (this.clerk.user) {
                this.isAuthenticated = true;
                this.user = this.clerk.user;
                log.info('✅ User is authenticated:', this.user.primaryEmailAddress?.emailAddress);
            } else {
                this.isAuthenticated = false;
                this.user = null;
                log.info('ℹ️ User is not authenticated');
            }

            // Listen for session changes
            this.clerk.addListener((resources) => {
                const wasAuthenticated = this.isAuthenticated;

                if (resources.user) {
                    this.isAuthenticated = true;
                    this.user = resources.user;
                    log.info('✅ User signed in:', this.user.primaryEmailAddress?.emailAddress);

                    // Show the app after successful sign-in
                    this.showApp();
                } else if (wasAuthenticated && !resources.user) {
                    // Only reload if user was previously authenticated (actual sign-out)
                    this.isAuthenticated = false;
                    this.user = null;
                    log.info('ℹ️ User signed out, reloading...');

                    // Reload the page to show sign-in UI
                    window.location.reload();
                }
            });

            return this.isAuthenticated;
        } catch (error) {
            log.error('❌ Failed to initialize Clerk:', error);
            throw error;
        }
    }

    /**
     * Mount the Clerk sign-in component
     * @param {HTMLElement} container - Container element for the sign-in UI
     */
    async mountSignIn(container) {
        if (!this.clerk) {
            throw new Error('Clerk not initialized. Call initialize() first.');
        }

        try {
            log.info('📝 Mounting Clerk sign-in component...');

            await this.clerk.mountSignIn(container, {
                appearance: {
                    elements: {
                        rootBox: 'clerk-sign-in-root',
                        card: 'clerk-sign-in-card',
                    },
                },
            });

            log.info('✅ Sign-in component mounted');
        } catch (error) {
            log.error('❌ Failed to mount sign-in component:', error);
            throw error;
        }
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        if (!this.clerk) {
            log.warn('⚠️ Clerk not initialized');
            return;
        }

        try {
            log.info('🚪 Signing out user...');
            await this.clerk.signOut();

            // Reload the page to show sign-in UI
            window.location.reload();
        } catch (error) {
            log.error('❌ Failed to sign out:', error);
            throw error;
        }
    }

    /**
     * Get the current user
     * @returns {Object|null} User object or null if not authenticated
     */
    getUser() {
        return this.user;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if authenticated
     */
    checkAuthentication() {
        return this.isAuthenticated;
    }

    /**
     * Show the main application
     */
    showApp() {
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app');

        if (authContainer) {
            authContainer.style.display = 'none';
        }

        if (appContainer) {
            appContainer.style.display = 'block';
        }

        // Dispatch event that app can initialize
        document.dispatchEvent(new CustomEvent('authenticationComplete'));
    }

    /**
     * Hide the main application and show auth UI
     */
    hideApp() {
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app');

        if (authContainer) {
            authContainer.style.display = 'flex';
        }

        if (appContainer) {
            appContainer.style.display = 'none';
        }
    }
}

// Export singleton instance
export const authService = new AuthService();

