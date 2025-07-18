// PopupManager.js - Single Responsibility: Popup interaction handling
export class PopupManager {
    constructor() {
        this.view = null;
    }

    // Initialize popup action handling
    initialize(view) {
        this.view = view;
        this.setupPopupActionHandlers();
    }

    setupPopupActionHandlers() {
        if (!this.view) return;

        // Use DOM event delegation for ArcGIS popup actions
        document.addEventListener('click', (e) => {
            // Look for buttons inside popup actions
            const button = e.target.closest('.esri-popup__action, .esri-popup__action-toggle, calcite-action, calcite-button');
            if (!button) return;

            // Make sure it's inside a popup
            const popup = button.closest('.esri-popup, .esri-popup__main-container, arcgis-popup');
            if (!popup) return;

            // Check for our action IDs in various ways ArcGIS might store them
            const actionId = button.getAttribute('data-action-id') ||
                button.getAttribute('data-id') ||
                button.id ||
                button.title;

            // Also check if the button text/title matches our actions
            const buttonText = button.textContent?.toLowerCase() || button.title?.toLowerCase() || '';

            if (actionId === 'copy-info' || buttonText.includes('copy')) {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                    this.handleCopyAction(button);
                }, 100);
            } else if (actionId === 'directions' || buttonText.includes('directions')) {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                    this.handleDirectionsAction(button);
                }, 100);
            } else if (actionId === 'refresh-metrics' || buttonText.includes('refresh')) {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                    this.handleRefreshMetricsAction(button);
                }, 100);
            }
        }, true); // Use capture phase to catch event before ArcGIS handles it
    }

    // Handle the copy action using DOM extraction (original working method)
    async handleCopyAction(buttonElement) {
        try {
            // Get the popup element - try multiple selectors
            let popup = document.querySelector('.esri-popup--is-visible');
            if (!popup) {
                popup = document.querySelector('.esri-popup[aria-hidden="false"]');
            }
            if (!popup) {
                popup = document.querySelector('.esri-popup');
            }

            if (!popup) {
                console.warn('No popup found');
                return;
            }

            // Extract all the information from the popup
            const copyData = this.extractPopupData(popup);

            if (copyData) {
                const success = await this.copyToClipboard(copyData);

                if (success) {
                    this.updateCopyButton(buttonElement, 'success');
                } else {
                    this.updateCopyButton(buttonElement, 'error');
                }
            }
        } catch (err) {
            console.error('Error handling copy action:', err);
            this.updateCopyButton(buttonElement, 'error');
        }
    }

    // Handle directions action
    async handleDirectionsAction(buttonElement) {
        try {
            // Get coordinates from the popup or view
            const graphic = this.view.popup?.selectedFeature;
            if (!graphic) return;

            const geometry = graphic.geometry;
            const attributes = graphic.attributes;

            if (!geometry || !geometry.longitude || !geometry.latitude) {
                this.showCopyFeedback('Location coordinates not available', 'error');
                return;
            }

            // Format address for directions
            const addressParts = [];
            if (attributes.address) addressParts.push(attributes.address);
            if (attributes.city) addressParts.push(attributes.city);
            if (attributes.state) addressParts.push(attributes.state);
            if (attributes.zip) addressParts.push(attributes.zip);

            const address = addressParts.length > 0
                ? encodeURIComponent(addressParts.join(', '))
                : `${geometry.latitude},${geometry.longitude}`;

            // Open directions
            const directionsUrl = `https://maps.apple.com/?daddr=${address}&dirflg=d`;
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;

            const isAppleDevice = /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
            const url = isAppleDevice ? directionsUrl : googleMapsUrl;

            window.open(url, '_blank');
            this.showCopyFeedback(`Opening directions to ${attributes.customer_name || 'location'}...`);

        } catch (error) {
            console.error('Failed to get directions:', error);
            this.showCopyFeedback('Failed to open directions', 'error');
        }
    }

    // Extract data directly from popup DOM (enhanced method)
    extractPopupData(popup) {
        const data = [];

        try {
            // Get the popup title (customer name)
            const titleElement = popup.querySelector('.esri-popup__header-title');
            if (titleElement) {
                data.push(`Customer: ${titleElement.textContent.trim()}`);
            }

            // Try multiple selectors for field data - be more comprehensive
            const fieldSelectors = [
                '.esri-popup__content table tr',     // Table rows (most common)
                '.esri-popup__content .esri-feature-fields tr',      // Feature fields
                '.esri-popup__content .esri-feature-fields__field-data tr', // Field data rows
                '.esri-popup__content .esri-popup__content-element tr', // Content elements
                '.esri-popup__content tr'            // Any table row in popup content
            ];

            let foundFields = false;
            for (const selector of fieldSelectors) {
                const elements = popup.querySelectorAll(selector);

                if (elements.length > 0) {
                    elements.forEach(element => {
                        // Try table row format - check for both td and th elements
                        const labelCell = element.querySelector('td:first-child, th:first-child');
                        const valueCell = element.querySelector('td:last-child, th:last-child');

                        if (labelCell && valueCell && labelCell !== valueCell) {
                            const label = labelCell.textContent.trim();
                            const value = valueCell.textContent.trim();

                            // Include all values, even empty ones (show as "N/A" or empty)
                            if (label && label !== value) {
                                const displayValue = value || 'N/A';
                                data.push(`${label}: ${displayValue}`);
                                foundFields = true;
                            }
                        }
                    });

                    if (foundFields) break;
                }
            }

            // If no fields found in tables, try to get from the feature attributes directly
            if (!foundFields) {
                const graphic = this.view.popup?.selectedFeature;
                if (graphic?.attributes) {
                    const attrs = graphic.attributes;

                    // Add ALL subscriber fields from the popup configuration
                    const subscriberFields = [
                        { attr: 'account', label: 'Account' },
                        { attr: 'status', label: 'Status' },
                        { attr: 'full_address', label: 'Full Address' },
                        { attr: 'service_type', label: 'Service Type' },
                        { attr: 'plan_name', label: 'Plan' },
                        { attr: 'ta5k', label: 'TA5K' },
                        { attr: 'remote_id', label: 'Remote ID' },
                        { attr: 'ont', label: 'ONT' },
                        { attr: 'has_electric', label: 'Electric Available' },
                        { attr: 'fiber_distance', label: 'Fiber Distance' },
                        { attr: 'light', label: 'Light Level' },
                        { attr: 'last_update', label: 'Last Update' },
                        { attr: 'service_address', label: 'Service Address' },
                        { attr: 'city', label: 'City' },
                        { attr: 'state', label: 'State' },
                        { attr: 'zip_code', label: 'Zip Code' },
                        { attr: 'county', label: 'County' }
                    ];

                    subscriberFields.forEach(field => {
                        const value = attrs[field.attr];
                        if (value !== undefined && value !== null) {
                            const displayValue = value.toString().trim() || 'N/A';
                            data.push(`${field.label}: ${displayValue}`);
                        }
                    });
                }
            }

            // Add timestamp
            data.push(`\nCopied: ${new Date().toLocaleString()}`);

            // Add coordinates if available
            const graphic = this.view.popup?.selectedFeature;
            if (graphic?.geometry) {
                const { latitude, longitude } = graphic.geometry;
                if (latitude && longitude) {
                    data.push(`Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                    data.push(`Maps: ${mapsUrl}`);
                }
            }

            return data.length > 0 ? data.join('\n') : null;

        } catch (error) {
            console.error('Error extracting popup data:', error);
            return null;
        }
    }

    // Update the copy button to show feedback
    updateCopyButton(button, state) {
        if (!button) return;

        // Store original values
        const originalText = button.getAttribute('text') || 'Copy info';
        const originalIcon = button.getAttribute('icon');
        const originalAppearance = button.getAttribute('appearance') || 'solid';

        if (state === 'success') {
            button.setAttribute('text', 'Copied!');
            button.setAttribute('icon', 'check');
            button.setAttribute('appearance', 'solid');
            button.style.backgroundColor = 'var(--calcite-color-status-success)';
        } else if (state === 'error') {
            button.setAttribute('text', 'Error');
            button.setAttribute('icon', 'x');
            button.setAttribute('appearance', 'solid');
            button.style.backgroundColor = 'var(--calcite-color-status-danger)';
        }

        // Reset button after 2 seconds
        setTimeout(() => {
            button.setAttribute('text', originalText);
            if (originalIcon) {
                button.setAttribute('icon', originalIcon);
            } else {
                // Default icons based on button type
                const buttonText = originalText.toLowerCase();
                if (buttonText.includes('copy')) {
                    button.setAttribute('icon', 'duplicate');
                } else if (buttonText.includes('directions')) {
                    button.setAttribute('icon', 'pin-tear');
                }
            }
            button.setAttribute('appearance', originalAppearance);
            button.style.backgroundColor = '';
        }, 2000);
    }

    // Modern clipboard API with fallback
    async copyToClipboard(text) {
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (err) {
        }

        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (err) {
            console.error('Fallback copy failed:', err);
            document.body.removeChild(textArea);
            return false;
        }
    }

    showCopyFeedback(message, type = 'success') {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'var(--calcite-color-status-danger)' : 'var(--calcite-color-status-success)'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-family: var(--calcite-font-family);
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Handle refresh metrics action
    async handleRefreshMetricsAction(button) {
        const popup = this.view.popup;
        const selectedFeature = popup.selectedFeature;

        if (!selectedFeature) {
            console.warn('No feature selected for metrics refresh');
            return;
        }

        const attributes = selectedFeature.attributes;
        const nodeSiteName = attributes.Name;

        if (!nodeSiteName) {
            console.warn('No node site name available for metrics refresh');
            return;
        }

        try {
            // Show loading indicator
            const loadingToast = this.showLoadingToast('Refreshing metrics...', nodeSiteName);

            // Import the service dynamically
            const { nodeSiteMetricsService } = await import('./NodeSiteMetricsService.js');

            // Refresh the popup by closing and reopening it
            const geometry = selectedFeature.geometry;
            popup.close();

            // Small delay to ensure popup is closed
            setTimeout(() => {
                popup.open({
                    location: geometry,
                    features: [selectedFeature]
                });

                // Remove loading toast
                if (loadingToast && loadingToast.parentNode) {
                    loadingToast.parentNode.removeChild(loadingToast);
                }

                this.showSuccessToast('Metrics refreshed successfully', nodeSiteName);
            }, 100);

        } catch (error) {
            console.error('Error refreshing metrics:', error);
            this.showErrorToast('Failed to refresh metrics', error.message);
        }
    }

    // Loading toast with spinner
    showLoadingToast(message, nodeSiteName) {
        const toast = document.createElement('calcite-notice');
        toast.setAttribute('kind', 'brand');
        toast.setAttribute('open', 'true');
        toast.setAttribute('icon', 'refresh');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            max-width: 320px;
            box-shadow: var(--calcite-shadow-2);
        `;

        toast.innerHTML = `
            <div slot="title">${message}</div>
            <div slot="message">
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                    <calcite-loader inline scale="s"></calcite-loader>
                    <span style="font-size: var(--calcite-font-size--1); color: var(--calcite-color-text-2);">
                        ${nodeSiteName}
                    </span>
                </div>
            </div>
        `;

        document.body.appendChild(toast);
        return toast;
    }

    // Success toast with checkmark
    showSuccessToast(message, nodeSiteName) {
        const toast = document.createElement('calcite-notice');
        toast.setAttribute('kind', 'positive');
        toast.setAttribute('open', 'true');
        toast.setAttribute('icon', 'check-circle');
        toast.setAttribute('auto-close', 'true');
        toast.setAttribute('auto-close-duration', '3000');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            max-width: 320px;
            box-shadow: var(--calcite-shadow-2);
        `;

        toast.innerHTML = `
            <div slot="title">${message}</div>
            <div slot="message">
                <span style="font-size: var(--calcite-font-size--1); color: var(--calcite-color-text-2);">
                    ${nodeSiteName}
                </span>
            </div>
        `;

        document.body.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);

        return toast;
    }

    // Error toast with warning icon
    showErrorToast(message, details = '') {
        const toast = document.createElement('calcite-notice');
        toast.setAttribute('kind', 'danger');
        toast.setAttribute('open', 'true');
        toast.setAttribute('icon', 'exclamation-mark-triangle');
        toast.setAttribute('auto-close', 'true');
        toast.setAttribute('auto-close-duration', '5000');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            max-width: 320px;
            box-shadow: var(--calcite-shadow-2);
        `;

        toast.innerHTML = `
            <div slot="title">${message}</div>
            ${details ? `<div slot="message">
                <span style="font-size: var(--calcite-font-size--1); color: var(--calcite-color-text-2);">
                    ${details}
                </span>
            </div>` : ''}
        `;

        document.body.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);

        return toast;
    }

    // Add additional popup actions for future features
    addCustomAction(layerId, actionId, actionConfig) {
        // This method can be used to add custom actions to specific layers
        // Implementation for future expansion
        // Custom action implementation for future expansion
    }

    // Cleanup method
    cleanup() {
        this.view = null;
    }
} 