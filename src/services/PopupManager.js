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

            // Try multiple selectors for field data
            const fieldSelectors = [
                '.esri-popup__content tr',           // Table rows
                '.esri-popup__content .esri-popup__content-element', // Content elements
                '.esri-popup__content .esri-feature-fields tr',      // Feature fields
                '.esri-popup__content .esri-feature-fields__field-data' // Field data
            ];

            let foundFields = false;
            for (const selector of fieldSelectors) {
                const elements = popup.querySelectorAll(selector);

                if (elements.length > 0) {
                    elements.forEach(element => {
                        // Try table row format
                        const labelCell = element.querySelector('td:first-child, th:first-child');
                        const valueCell = element.querySelector('td:last-child');

                        if (labelCell && valueCell) {
                            const label = labelCell.textContent.trim();
                            const value = valueCell.textContent.trim();

                            if (value && value !== 'null' && value !== '' && value !== label) {
                                data.push(`${label}: ${value}`);
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

                    // Add common subscriber fields
                    if (attrs.customer_number) data.push(`Account #: ${attrs.customer_number}`);
                    if (attrs.address) data.push(`Service Address: ${attrs.address}`);
                    if (attrs.city) data.push(`City: ${attrs.city}`);
                    if (attrs.state) data.push(`State: ${attrs.state}`);
                    if (attrs.zip) data.push(`ZIP: ${attrs.zip}`);
                    if (attrs.status) data.push(`Connection Status: ${attrs.status}`);
                    if (attrs.phone_number) data.push(`Phone: ${attrs.phone_number}`);
                    if (attrs.county) data.push(`County: ${attrs.county}`);
                }
            }

            // Add timestamp
            data.push(`Copied: ${new Date().toLocaleString()}`);

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