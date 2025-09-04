// MobileTabBar.js - Manages mobile tab bar interactions and dialogs

export class MobileTabBar {
    constructor() {
        this.tabBar = document.getElementById('mobile-tab-bar');
        this.closeButton = document.getElementById('mobile-close-button');
        this.currentDialog = null;
    }

    async init() {
        await customElements.whenDefined('calcite-segmented-control');
        this.setupEventListeners();
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
                // Open the mobile power outages dialog
                const powerDialog = document.getElementById('mobile-power-sheet');
                if (powerDialog) {
                    this.closeCurrentPanel(); // Close any open panels first
                    powerDialog.open = true;
                    this.currentDialog = powerDialog;
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
                console.warn('⚠️ CalciteUI components not ready, but proceeding with dialog open:', error);
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

                console.log('✅ Mobile subscriber tab initialized successfully');
            }
        } catch (error) {
            console.warn('⚠️ Failed to initialize mobile subscribers tab:', error);
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

                console.log('🔧 Force-initialized mobile subscriber dialog');
            }
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
            console.log('🔧 Recovering mobile UI after component failures...');

            // Ensure all mobile dialogs are properly configured
            const dialogs = document.querySelectorAll('.mobile-only calcite-dialog');
            dialogs.forEach(dialog => {
                if (dialog) {
                    dialog.style.display = 'block';
                    dialog.style.visibility = 'visible';

                    // Ensure content is visible
                    const content = dialog.querySelector('[slot="content"]');
                    if (content) {
                        content.style.display = 'block';
                        content.style.visibility = 'visible';
                        content.style.opacity = '1';
                    }
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
            }

            console.log('✅ Mobile UI recovery completed');
        } catch (error) {
            console.warn('⚠️ Mobile UI recovery failed:', error);
        }
    }
}


