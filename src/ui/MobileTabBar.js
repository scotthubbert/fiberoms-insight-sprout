// MobileTabBar.js - Manages mobile tab bar interactions and dialogs
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('MobileTabBar');

export class MobileTabBar {
    constructor() {
        this.tabBar = document.getElementById('mobile-tab-bar');
        this.closeButton = document.getElementById('mobile-close-button');
        this.currentDialog = null;
    }

    async init() {
        try {
            // Wait for critical components to be defined
            await Promise.all([
                customElements.whenDefined('calcite-segmented-control'),
                customElements.whenDefined('calcite-dialog'),
                customElements.whenDefined('calcite-switch'),
                customElements.whenDefined('calcite-list-item'),
                customElements.whenDefined('calcite-list'),
                customElements.whenDefined('calcite-block')
            ]);

            // Wait for components to be ready
            const tabBar = document.getElementById('mobile-tab-bar');
            if (tabBar && typeof tabBar.componentOnReady === 'function') {
                await tabBar.componentOnReady();
            }

            // Initialize event listeners
            this.setupEventListeners();

            log.info('✅ Mobile tab bar initialized successfully');
        } catch (error) {
            log.warn('⚠️ Mobile tab bar initialization error:', error);
            // Still set up event listeners even if component initialization fails
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        if (this.tabBar) {
            this.tabBar.addEventListener('calciteSegmentedControlChange', (e) => {
                this.handleTabSelection(e.target.selectedItem.value);
            });
        }

        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => {
                this.closeCurrentPanel();
            });
        }

        this.setupCloseButtons();
        this.setupMobileSearchDialogListeners();
        this.setupMobileMetricsChip();
    }

    setupMobileSearchDialogListeners() {
        const mobileSearchDialog = document.getElementById('mobile-search-sheet');
        if (mobileSearchDialog) {
            mobileSearchDialog.addEventListener('calciteDialogOpen', () => {

            });

        }
    }

    setupMobileMetricsChip() {
        const mobileMetricsChip = document.getElementById('mobile-metrics-chip');
        if (mobileMetricsChip) {
            mobileMetricsChip.addEventListener('click', () => {
                // Open the mobile subscribers dialog to show offline count details
                const subscribersDialog = document.getElementById('mobile-subscribers-sheet');
                if (subscribersDialog) {
                    this.closeCurrentPanel(); // Close any open panels first
                    subscribersDialog.open = true;
                    this.currentDialog = subscribersDialog;
                    this.closeButton.classList.add('show');
                }
            });
        }
    }

    async handleTabSelection(tabValue) {
        this.closeCurrentPanel();

        const dialogId = `mobile-${tabValue}-sheet`;
        const dialog = document.getElementById(dialogId);

        if (dialog) {
            // Ensure CalciteUI components are properly initialized before opening
            try {
                // Wait for critical CalciteUI components with timeout
                await Promise.race([
                    Promise.all([
                        customElements.whenDefined('calcite-dialog'),
                        customElements.whenDefined('calcite-switch'),
                        customElements.whenDefined('calcite-list-item'),
                        customElements.whenDefined('calcite-list'),
                        customElements.whenDefined('calcite-block')
                    ]),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('CalciteUI timeout')), 2000))
                ]);

                dialog.open = true;
                this.currentDialog = dialog;
                this.closeButton.classList.add('show');

                // Initialize functionality for specific tabs
                if (tabValue === 'other') {
                    this.initializeMobileOtherTab();
                } else if (tabValue === 'subscribers') {
                    await this.initializeMobileSubscribersTab();
                }
            } catch (error) {
                log.warn('⚠️ CalciteUI components not ready, but proceeding with dialog open:', error);
                // Still try to open the dialog - force it open regardless of component state
                dialog.open = true;
                this.currentDialog = dialog;
                this.closeButton.classList.add('show');

                // Force subscriber initialization even if CalciteUI failed
                if (tabValue === 'subscribers') {
                    await this.forceInitializeMobileSubscribersTab();
                }
            }
        }
    }

    async initializeMobileSubscribersTab() {
        try {
            // Ensure subscriber switches are properly initialized
            const subscriberDialog = document.getElementById('mobile-subscribers-sheet');
            if (subscriberDialog) {
                // Wait a bit for components to fully render
                await new Promise(resolve => setTimeout(resolve, 150));

                const switches = subscriberDialog.querySelectorAll('calcite-switch');
                const listItems = subscriberDialog.querySelectorAll('calcite-list-item');

                // Ensure all elements are visible and functional
                switches.forEach(switchEl => {
                    switchEl.style.display = 'block';
                    switchEl.style.visibility = 'visible';
                    switchEl.style.opacity = '1';
                });

                listItems.forEach(item => {
                    item.style.display = 'block';
                    item.style.visibility = 'visible';
                    item.style.opacity = '1';
                });

                // Update subscriber statistics
                await this.updateMobileSubscriberStatistics();

                log.info('✅ Mobile subscriber tab initialized successfully');
            }
        } catch (error) {
            log.warn('⚠️ Failed to initialize mobile subscribers tab:', error);
            await this.forceInitializeMobileSubscribersTab();
        }
    }

    async forceInitializeMobileSubscribersTab() {
        // Fallback initialization that works even if CalciteUI components fail
        const subscriberDialog = document.getElementById('mobile-subscribers-sheet');
        if (subscriberDialog) {
            // Force all content to be visible with inline styles
            const content = subscriberDialog.querySelector('[slot="content"]');
            if (content) {
                content.style.display = 'block';
                content.style.visibility = 'visible';
                content.style.opacity = '1';
                content.style.padding = '16px';

                // Force all child elements to be visible
                const allElements = content.querySelectorAll('*');
                allElements.forEach(el => {
                    el.style.display = el.style.display || 'block';
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                });

                // Special handling for list items
                const listItems = content.querySelectorAll('calcite-list-item');
                listItems.forEach(item => {
                    item.style.minHeight = '56px';
                    item.style.padding = '12px';
                    item.style.borderBottom = '1px solid #e0e0e0';
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                });

                // Special handling for switches
                const switches = content.querySelectorAll('calcite-switch');
                switches.forEach(switchEl => {
                    switchEl.style.display = 'inline-block';
                    switchEl.style.minWidth = '44px';
                    switchEl.style.minHeight = '24px';
                });

                // Update subscriber statistics even in fallback mode
                await this.updateMobileSubscriberStatistics();

                log.info('🔧 Force-initialized mobile subscriber dialog');
            }
        }
    }

    async updateMobileSubscriberStatistics() {
        try {
            // Import subscriber data service dynamically to avoid circular dependencies
            const { subscriberDataService } = await import('../dataService.js');
            
            const summary = await subscriberDataService.getSubscribersSummary();
            
            const mobileOnlineCountEl = document.getElementById('mobile-online-count-display');
            const mobileOfflineCountEl = document.getElementById('mobile-offline-count-display');
            const mobileLastUpdatedEl = document.getElementById('mobile-last-updated-display');
            
            if (mobileOnlineCountEl) {
                mobileOnlineCountEl.textContent = summary.online?.toLocaleString() || '0';
            }
            if (mobileOfflineCountEl) {
                mobileOfflineCountEl.textContent = summary.offline?.toLocaleString() || '0';
            }
            if (mobileLastUpdatedEl) {
                const lastUpdated = summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleString() : 'Never';
                mobileLastUpdatedEl.textContent = `Last updated: ${lastUpdated}`;
            }
            
            log.info('✅ Mobile subscriber statistics updated');
        } catch (error) {
            log.error('Failed to update mobile subscriber statistics:', error);
            
            // Set error states
            const mobileOnlineCountEl = document.getElementById('mobile-online-count-display');
            const mobileOfflineCountEl = document.getElementById('mobile-offline-count-display');
            const mobileLastUpdatedEl = document.getElementById('mobile-last-updated-display');
            
            if (mobileOnlineCountEl) mobileOnlineCountEl.textContent = '--';
            if (mobileOfflineCountEl) mobileOfflineCountEl.textContent = '--';
            if (mobileLastUpdatedEl) mobileLastUpdatedEl.textContent = 'Last updated: Error loading data';
        }
    }

    initializeMobileOtherTab() {
        // Update build info when other tab is opened
        this.updateMobileBuildInfo();
        this.setupMobileResourceLinks();
    }

    updateMobileBuildInfo() {
        // Import build info dynamically to avoid circular dependencies
        import('../utils/buildInfo.js').then(({ getFormattedBuildInfo }) => {
            const info = getFormattedBuildInfo();

            const buildVersionElement = document.getElementById('mobile-build-version-text');
            const buildDateElement = document.getElementById('mobile-build-date-text');
            const environmentElement = document.getElementById('mobile-environment-text');

            if (buildVersionElement) {
                buildVersionElement.textContent = info.displayVersion;
            }

            if (buildDateElement) {
                buildDateElement.textContent = info.buildDate;
            }

            if (environmentElement) {
                environmentElement.textContent = info.environment.charAt(0).toUpperCase() + info.environment.slice(1);
            }
        });
    }

    setupMobileResourceLinks() {
        const docsLink = document.getElementById('mobile-docs-link');
        const issueLink = document.getElementById('mobile-issue-link');

        if (docsLink) {
            docsLink.addEventListener('click', () => {
                window.open('https://github.com/your-org/fiberoms-insight-pwa/wiki', '_blank');
            });
        }

        if (issueLink) {
            issueLink.addEventListener('click', () => {
                window.open('https://github.com/your-org/fiberoms-insight-pwa/issues', '_blank');
            });
        }
    }

    closeCurrentPanel() {
        if (this.currentDialog) {
            this.currentDialog.open = false;
            this.currentDialog = null;
        }
        this.closeButton.classList.remove('show');

        if (this.tabBar) {
            this.tabBar.selectedItem = null;
        }
    }

    setupCloseButtons() {
        const closeButtons = document.querySelectorAll('.dialog-close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.closeCurrentPanel();
            });
        });
    }

    recoverMobileUI() {
        // Recovery method to restore mobile UI functionality after CalciteUI errors
        try {
            log.info('🔧 Recovering mobile UI after component failures...');

            // Ensure all mobile dialogs are properly configured
            const dialogs = document.querySelectorAll('.mobile-only calcite-dialog');
            dialogs.forEach(dialog => {
                if (dialog) {
                    // Force dialog to be visible
                    dialog.style.display = 'block';
                    dialog.style.visibility = 'visible';
                    dialog.style.opacity = '1';
                    dialog.style.zIndex = '1000';
                    dialog.style.position = 'fixed';

                    // Ensure all dialog parts are visible
                    ['header', 'content', 'footer'].forEach(slot => {
                        const part = dialog.querySelector(`[slot="${slot}"]`);
                        if (part) {
                            part.style.display = 'block';
                            part.style.visibility = 'visible';
                            part.style.opacity = '1';
                        }
                    });

                    // Force dialog container to be visible
                    const container = dialog.shadowRoot?.querySelector('.container');
                    if (container) {
                        container.style.display = 'flex';
                        container.style.visibility = 'visible';
                        container.style.opacity = '1';
                        container.style.transform = 'none';
                    }

                    // Force all child elements to be visible
                    const allElements = dialog.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.tagName.toLowerCase().startsWith('calcite-')) {
                            el.style.display = el.style.display || 'block';
                            el.style.visibility = 'visible';
                            el.style.opacity = '1';
                        }
                    });
                }
            });

            // Special recovery for subscriber dialog
            const subscriberDialog = document.getElementById('mobile-subscribers-sheet');
            if (subscriberDialog) {
                this.forceInitializeMobileSubscribersTab();
            }

            // Ensure tab bar is functional
            const tabBar = document.getElementById('mobile-tab-bar');
            if (tabBar) {
                tabBar.style.display = 'block';
                tabBar.style.visibility = 'visible';
                tabBar.style.opacity = '1';
                tabBar.style.transform = 'none';
                tabBar.style.transition = 'none';
                tabBar.style.pointerEvents = 'auto';
            }

            // Ensure close button is visible when needed
            if (this.currentDialog) {
                this.closeButton.style.display = 'block';
                this.closeButton.style.visibility = 'visible';
                this.closeButton.style.opacity = '1';
                this.closeButton.classList.add('show');
            }

            log.info('✅ Mobile UI recovery completed');
        } catch (error) {
            log.warn('⚠️ Mobile UI recovery failed:', error);
        }
    }
}


