// PopupManager.js - Single Responsibility: Popup interaction handling
import { createLogger } from '../utils/logger.js';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js';

// Initialize logger for this module
const log = createLogger('PopupManager');

export class PopupManager {
    constructor() {
        this.view = null;
        // Bug 1 fix: Track processed buttons to prevent duplicate listener attachments
        // Use WeakMap to avoid memory leaks - keys are button elements, values are handler functions
        this._buttonListeners = new WeakMap();
        // Track actionIds processed per popup instance to prevent re-processing after re-renders
        this._processedActionIds = new Set();
    }

    /**
     * Check if device is mobile
     * @returns {boolean} - True if mobile device
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    // Initialize popup action handling
    initialize(view) {
        this.view = view;
        this.setupPopupActionHandlers();
    }

    // Clean up watchers (Bug 2 fix: proper cleanup method)
    destroy() {
        if (this._popupVisibleWatcher) {
            this._popupVisibleWatcher.remove();
            this._popupVisibleWatcher = null;
        }
        if (this._popupFeatureWatcher) {
            this._popupFeatureWatcher.remove();
            this._popupFeatureWatcher = null;
        }
        // Bug 1 fix: Clear processed actionIds when destroying
        this._processedActionIds.clear();
        this.view = null;
        log.info('PopupManager watchers cleaned up');
    }

    setupPopupActionHandlers() {
        if (!this.view) return;

        // Clean up any existing watchers before creating new ones (Bug 2 fix)
        if (this._popupVisibleWatcher) {
            this._popupVisibleWatcher.remove();
            this._popupVisibleWatcher = null;
        }
        if (this._popupFeatureWatcher) {
            this._popupFeatureWatcher.remove();
            this._popupFeatureWatcher = null;
        }

        // ArcGIS 4.34 Map Components: Popup is in shadow DOM, so we need to:
        // 1. Watch for popup visibility changes using reactiveUtils
        // 2. Find the popup container and attach listeners directly

        // Watch for popup visibility changes using modern reactiveUtils
        // Bug 2 fix: Store watch handle for cleanup
        this._popupVisibleWatcher = reactiveUtils.watch(
            () => this.view.popup?.visible,
            (visible) => {
                // If the manager has been destroyed, skip any pending callbacks
                if (!this.view) return;

                // Toggle data attribute on map element for mobile CSS targeting
                const mapElement = document.getElementById('map');
                if (mapElement) {
                    if (visible) {
                        mapElement.setAttribute('data-popup-visible', 'true');
                    } else {
                        mapElement.removeAttribute('data-popup-visible');
                    }
                }

                if (visible) {
                    log.info('Popup became visible, attaching action handlers...');
                    // Small delay to ensure popup DOM is fully rendered
                    setTimeout(() => {
                        if (!this.view) return;
                        this.attachPopupActionListeners();
                    }, 100);
                }
            }
        );

        // Also watch for selected feature changes (when navigating between multiple features)
        // Bug 2 fix: Store watch handle for cleanup
        this._popupFeatureWatcher = reactiveUtils.watch(
            () => this.view.popup?.selectedFeature,
            (feature, oldFeature) => {
                // If the manager has been destroyed, skip any pending callbacks
                if (!this.view) return;
                if (feature) {
                    // Bug 1 fix: Clear processed actionIds when feature actually changes
                    // This allows re-processing buttons for the new feature
                    if (oldFeature !== feature) {
                        log.info('Popup feature changed, clearing processed actionIds...');
                        this._processedActionIds.clear();
                    }
                    log.info('Popup feature changed, re-attaching action handlers...');
                    setTimeout(() => {
                        if (!this.view) return;
                        this.attachPopupActionListeners();
                    }, 100);
                }
            }
        );

        log.info('Popup watchers initialized for ArcGIS 4.34 using reactiveUtils');
    }

    attachPopupActionListeners() {
        try {
            // If the view or popup is no longer available (e.g., after destroy()),
            // safely exit without attempting to access properties on a null view.
            if (!this.view || !this.view.popup) {
                log.warn('PopupManager view or popup not available; skipping attachPopupActionListeners');
                return;
            }

            // Bug 1 fix: Get current selected feature to create stable popup instance identifier
            // Use feature's geometry or attributes to create a stable ID that persists across re-renders
            const currentFeature = this.view.popup?.selectedFeature;
            let popupInstanceId = 'no-feature';
            if (currentFeature) {
                // Try to use a stable identifier from the feature
                const featureId = currentFeature.attributes?.OBJECTID ||
                    currentFeature.attributes?.FID ||
                    currentFeature.attributes?.id ||
                    (currentFeature.geometry ? JSON.stringify(currentFeature.geometry.extent || currentFeature.geometry) : null);
                popupInstanceId = featureId ? `feature-${featureId}` : `feature-${currentFeature.attributes?.Name || currentFeature.attributes?.name || 'unknown'}`;
            }

            // Find the popup container - it may be in the regular DOM or shadow DOM
            let popupContainer = null;

            // Try multiple strategies to find the popup
            // Strategy 1: Look for the widget container in the view
            if (this.view.popup?.container) {
                popupContainer = this.view.popup.container;
                log.info('Found popup via view.popup.container');
            }

            // Strategy 2: Query for visible popup in DOM
            if (!popupContainer) {
                popupContainer = document.querySelector('.esri-popup.esri-popup--is-visible');
                if (popupContainer) {
                    log.info('Found popup via .esri-popup--is-visible selector');
                }
            }

            // Strategy 3: Try to find popup inside the map component
            if (!popupContainer) {
                const mapEl = document.getElementById('map');
                if (mapEl && mapEl.shadowRoot) {
                    popupContainer = mapEl.shadowRoot.querySelector('.esri-popup');
                    if (popupContainer) {
                        log.info('Found popup inside map shadow DOM');
                    }
                }
            }

            if (!popupContainer) {
                log.warn('Could not find popup container');
                return;
            }

            // Hardcoded action titles (popup.actions doesn't populate in 4.34)
            const actionTitles = {
                'copy-info': 'Copy Info',
                'directions': 'Get Directions',
                'zoom-to-feature': 'Zoom to',
                'refresh-metrics': 'Refresh Metrics',
                'track-vehicle': 'Track Vehicle',
                'copy-truck-info': 'Copy Truck Info',
                'get-directions': 'Get Directions'
            };

            log.info('Using hardcoded action titles for known actions');

            // Find ONLY custom action buttons in the popup (Bug 2 fix)
            // More specific selector to avoid matching built-in ArcGIS buttons
            const actionButtons = popupContainer.querySelectorAll(
                '.esri-popup__action[data-action-id], ' +
                '.esri-popup__actions calcite-button[data-action-id], ' +
                '.esri-popup__actions calcite-action[data-action-id], ' +
                'calcite-button[data-action-id], ' +
                'calcite-action[data-action-id]'
            );

            log.info(`Found ${actionButtons.length} custom action buttons in popup`);

            // Bug 1 fix: Create unique key for this popup instance's buttons
            // This ensures we don't re-process buttons when ArcGIS re-renders them
            const buttonKeyPrefix = `popup-${popupInstanceId}`;

            // Attach click listeners to each button
            actionButtons.forEach((button, index) => {
                const actionId = button.getAttribute('data-action-id') ||
                    button.getAttribute('id') ||
                    button.getAttribute('data-action');

                // Skip built-in ArcGIS actions (dock, close, zoom, etc.) - they handle their own functionality
                const builtInActions = ['popup-dock-action', 'popup-close-action', 'zoom-to-feature'];
                if (builtInActions.includes(actionId)) {
                    log.info(`Skipping built-in action: ${actionId}`);
                    return;
                }

                // Bug 1 fix: Create unique identifier for this button instance
                const buttonInstanceId = `${buttonKeyPrefix}-${actionId}`;

                // Bug 1 fix: Check if we've already processed this actionId for this popup instance
                // This prevents duplicate listeners when ArcGIS re-renders buttons for the same feature
                if (this._processedActionIds.has(buttonInstanceId)) {
                    log.info(`Button ${actionId} (instance ${buttonInstanceId}) already processed for this popup, skipping`);
                    return;
                }

                // Also check if this specific button element already has a listener attached
                // (handles case where button wasn't re-rendered but we're processing again)
                if (button.hasAttribute('data-listener-attached') &&
                    button.getAttribute('data-listener-instance-id') === buttonInstanceId) {
                    log.info(`Button element ${actionId} (instance ${buttonInstanceId}) already has listener, skipping`);
                    // Still mark as processed in case it wasn't tracked
                    this._processedActionIds.add(buttonInstanceId);
                    return;
                }

                // Bug 1 fix: Remove any existing listener from this button element before attaching new one
                // This handles the case where ArcGIS re-rendered the button but we're processing it again
                const existingHandler = this._buttonListeners.get(button);
                if (existingHandler) {
                    log.info(`Removing existing listener from button ${actionId} before re-attaching`);
                    button.removeEventListener('click', existingHandler, true);
                    this._buttonListeners.delete(button);
                }

                // Set text on the ORIGINAL button before cloning (for Calcite components)
                if (button.tagName === 'CALCITE-ACTION' || button.tagName === 'CALCITE-BUTTON') {
                    // Try to get title from the hardcoded action configuration
                    let title = null;
                    if (actionId && actionTitles[actionId]) {
                        title = actionTitles[actionId];
                    } else {
                        // Fallback to element attributes (for custom copy buttons in popup content)
                        title = button.getAttribute('title') || button.getAttribute('aria-label') || button.getAttribute('text');
                    }

                    // Set text attribute if we have a title and it's not already set
                    if (title && !button.getAttribute('text')) {
                        button.setAttribute('text', title);
                        button.setAttribute('text-enabled', 'true');
                        log.info(`Set text for action ${actionId}: ${title}`);
                    }
                }

                // Now clone the button with the updated attributes
                const clone = button.cloneNode(true);
                clone.setAttribute('data-listener-attached', 'true'); // Mark as processed (Bug 2 fix)
                clone.setAttribute('data-listener-instance-id', buttonInstanceId); // Bug 1 fix: Track instance

                // Bug 3 fix: Check for parent node before replacement
                if (button.parentNode) {
                    button.parentNode.replaceChild(clone, button);
                } else {
                    log.warn(`Button ${actionId} has no parent node, skipping replacement`);
                    return;
                }

                const buttonText = (clone.textContent || clone.title || clone.getAttribute('aria-label') || '').toLowerCase();

                log.info(`Button ${index}:`, {
                    text: buttonText,
                    actionId: actionId,
                    instanceId: buttonInstanceId,
                    tagName: clone.tagName,
                    title: clone.getAttribute('title'),
                    textAttr: clone.getAttribute('text')
                });

                // Bug 1 fix: Create handler function and store reference for cleanup
                const clickHandler = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    log.info('Popup action button clicked:', { buttonText, actionId, instanceId: buttonInstanceId });

                    if (actionId?.includes('copy') || buttonText.includes('copy')) {
                        await this.handleCopyAction(clone);
                    } else if (actionId?.includes('direction') || buttonText.includes('direction')) {
                        await this.handleDirectionsAction(clone);
                    } else if (actionId?.includes('refresh') || buttonText.includes('refresh')) {
                        await this.handleRefreshMetricsAction(clone);
                    } else if (actionId?.includes('track') || buttonText.includes('track')) {
                        await this.handleTrackVehicleAction();
                    }
                };

                // Attach handler and store reference in WeakMap for potential cleanup
                clone.addEventListener('click', clickHandler, true);
                this._buttonListeners.set(clone, clickHandler);

                // Bug 1 fix: Track that we've processed this actionId for this popup instance
                this._processedActionIds.add(buttonInstanceId);
            });

        } catch (error) {
            log.error('Error attaching popup action listeners:', error);
        }
    }

    // Handle the copy action using modern API (4.34+) with DOM extraction fallback
    async handleCopyAction(buttonElement) {
        try {
            let copyData;

            // Method 1: Extract from view.popup.selectedFeature (modern, reliable)
            const graphic = this.view.popup?.selectedFeature;
            if (graphic && graphic.attributes) {
                copyData = this.extractDataFromFeature(graphic);
            }

            // Method 2: Fallback to DOM extraction if no feature data
            if (!copyData) {
                let popup = document.querySelector('.esri-popup--is-visible');
                if (!popup) {
                    popup = document.querySelector('.esri-popup[aria-hidden="false"]');
                }
                if (!popup) {
                    popup = document.querySelector('.esri-popup');
                }

                if (popup) {
                    copyData = this.extractPopupData(popup);
                }
            }

            if (copyData) {
                const success = await this.copyToClipboard(copyData);

                if (success) {
                    // Only update button feedback, no toast notification
                    if (buttonElement) this.updateCopyButton(buttonElement, 'success');
                    log.info('Data copied to clipboard successfully');
                } else {
                    if (buttonElement) this.updateCopyButton(buttonElement, 'error');
                    log.error('Failed to copy to clipboard');
                }
            } else {
                log.warn('No data to copy');
                if (buttonElement) this.updateCopyButton(buttonElement, 'error');
            }
        } catch (err) {
            log.error('Error handling copy action:', err);
            this.showCopyFeedback('Error copying data', 'error');
            if (buttonElement) this.updateCopyButton(buttonElement, 'error');
        }
    }

    // Extract data directly from graphic feature (modern approach)
    extractDataFromFeature(graphic) {
        const data = [];
        const attributes = graphic.attributes;

        const nameKeys = new Set(['name', 'customer_name', 'Name']);

        // Check if this is an MST Terminal based on modelnumbe field
        const modelnumbe = attributes.modelnumbe || attributes.MODELNUMBE;
        const isMSTTerminal = modelnumbe && modelnumbe.toString().toUpperCase().includes('MST');

        // Check if this is a Pole based on wmElementN field
        const isPole = attributes.wmElementN !== undefined;

        // Check if this is a Splitter (has STRUCTURE_ and CLLI/EQUIP_FRAB but not MST)
        const isSplitter = (attributes.STRUCTURE_ !== undefined || attributes.structure_ !== undefined) &&
            (attributes.CLLI !== undefined || attributes.EQUIP_FRAB !== undefined) &&
            !isMSTTerminal;

        // Check if this is a Slack Loop (has structure, type, cable fields)
        const isSlackLoop = (attributes.structure !== undefined || attributes.type !== undefined || attributes.cable !== undefined) &&
            !isMSTTerminal && !isSplitter;

        // If MST Terminal, use popup field labels
        if (isMSTTerminal) {
            // MST Terminal field configuration matching popup labels
            const mstFields = [
                { fieldName: 'distributi', label: 'DA', altFieldName: 'DISTRIBUTI' },
                { fieldName: 'equipmentn', label: 'EQUIP_FRAB', altFieldName: 'EQUIPMENTN' },
                { fieldName: 'modelnumbe', label: 'Model Number', altFieldName: 'MODELNUMBE' },
                { fieldName: 'outputport', label: 'Output Port Count', altFieldName: 'OUTPUTPORT' },
                { fieldName: 'partnumber', label: 'Part Number', altFieldName: 'PARTNUMBER' }
            ];

            mstFields.forEach(field => {
                const value = attributes[field.fieldName] !== undefined ? attributes[field.fieldName] :
                    (field.altFieldName ? attributes[field.altFieldName] : undefined);

                if (value !== null && value !== undefined && value !== '') {
                    let displayValue = value;
                    // Format outputport as integer if it's a number
                    if (field.fieldName === 'outputport' && typeof value === 'number') {
                        displayValue = Math.round(value).toString();
                    } else {
                        displayValue = value.toString();
                    }
                    data.push(`${field.label}: ${displayValue}`);
                }
            });
        } else if (isSplitter) {
            // Splitter field configuration matching popup labels
            const splitterFields = [
                { fieldName: 'STRUCTURE_', label: 'Structure ID', altFieldName: 'structure_' },
                { fieldName: 'CLLI', label: 'CLLI Code', altFieldName: 'clli' },
                { fieldName: 'EQUIP_FRAB', label: 'Equipment FRAB', altFieldName: 'equip_frab' },
                { fieldName: 'OUTPUTPORT', label: 'Output Port Count', altFieldName: 'outputport' }
            ];

            splitterFields.forEach(field => {
                const value = attributes[field.fieldName] !== undefined ? attributes[field.fieldName] :
                    (field.altFieldName ? attributes[field.altFieldName] : undefined);

                if (value !== null && value !== undefined && value !== '') {
                    let displayValue = value;
                    // Format outputport as integer if it's a number
                    if (field.fieldName === 'OUTPUTPORT' && typeof value === 'number') {
                        displayValue = Math.round(value).toString();
                    } else {
                        displayValue = value.toString();
                    }
                    data.push(`${field.label}: ${displayValue}`);
                }
            });
        } else if (isSlackLoop) {
            // Slack Loop field configuration matching popup labels
            const slackLoopFields = [
                { fieldName: 'structure', label: 'Structure ID' },
                { fieldName: 'type', label: 'Type' },
                { fieldName: 'cable', label: 'Cable' },
                { fieldName: 'length', label: 'Length (ft)' }
            ];

            slackLoopFields.forEach(field => {
                const value = attributes[field.fieldName];

                if (value !== null && value !== undefined && value !== '') {
                    const displayValue = value.toString();
                    data.push(`${field.label}: ${displayValue}`);
                }
            });
        } else {
            // Standard feature extraction
            // Add title if available
            if (attributes.name || attributes.customer_name || attributes.Name) {
                data.push(`Name: ${attributes.name || attributes.customer_name || attributes.Name}`);
            }

            // Add all attributes in a readable format
            Object.keys(attributes).forEach(key => {
                // Skip internal/system fields
                if (key.startsWith('__') || key === 'OBJECTID' || key === 'FID') {
                    return;
                }

                // Skip name-related fields we've already added above
                if (nameKeys.has(key)) {
                    return;
                }

                // Skip latitude and longitude for poles (we add Coordinates and Maps Link instead)
                if (isPole && (key.toLowerCase() === 'latitude' || key.toLowerCase() === 'longitude')) {
                    return;
                }

                const value = attributes[key];

                // Format the value
                let displayValue = value;
                if (value === null || value === undefined || value === '') {
                    return; // Skip empty values
                } else if (typeof value === 'boolean') {
                    displayValue = value ? 'Yes' : 'No';
                } else if (typeof value === 'number' && !isNaN(value)) {
                    displayValue = value.toFixed(2);
                } else if (key.toLowerCase().includes('date') || key.toLowerCase().includes('update')) {
                    try {
                        displayValue = new Date(value).toLocaleString();
                    } catch (e) {
                        displayValue = value;
                    }
                }

                // Format key name (convert snake_case or camelCase to Title Case)
                const formattedKey = key
                    .replace(/_/g, ' ')
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())
                    .trim();

                data.push(`${formattedKey}: ${displayValue}`);
            });
        }

        // Add coordinates and Google Maps link if geometry is available
        if (graphic.geometry) {
            const geometry = graphic.geometry;
            let latitude, longitude;

            // Handle different geometry types and coordinate systems
            if (geometry.type === 'point') {
                // ArcGIS Point geometry uses x (longitude) and y (latitude) or longitude/latitude properties
                longitude = geometry.longitude !== undefined ? geometry.longitude : geometry.x;
                latitude = geometry.latitude !== undefined ? geometry.latitude : geometry.y;
            } else if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
                // GeoJSON format: [longitude, latitude]
                [longitude, latitude] = geometry.coordinates;
            }

            if (latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)) {
                // Use 14 decimal places for coordinates to match popup display
                data.push(`Coordinates: ${latitude.toFixed(14)}, ${longitude.toFixed(14)}`);
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                data.push(`Maps Link: ${mapsUrl}`);
            }
        }

        return data.length > 0 ? data.join('\n') : null;
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
            log.error('Failed to get directions:', error);
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

                            // Skip latitude and longitude for poles (we add Coordinates and Maps Link instead)
                            if (label.toLowerCase() === 'latitude' || label.toLowerCase() === 'longitude') {
                                return;
                            }

                            // Include all values, with clear messaging for missing data
                            if (label && label !== value) {
                                const displayValue = value || 'Not Available in Dataset';
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

                    // Add MST Terminal fields from the popup configuration
                    // Support both uppercase and lowercase field names (check both variations)
                    const mstTerminalFields = [
                        { attrs: ['distributi', 'DISTRIBUTI'], label: 'DA' },
                        { attrs: ['equipmentn', 'EQUIPMENTN'], label: 'EQUIP_FRAB' },
                        { attrs: ['modelnumbe', 'MODELNUMBE'], label: 'Model Number' },
                        { attrs: ['outputport', 'OUTPUTPORT'], label: 'Output Port Count' },
                        { attrs: ['partnumber', 'PARTNUMBER'], label: 'Part Number' },
                        { attrs: ['CLLI', 'clli'], label: 'CLLI Code' },
                        { attrs: ['STRUCTURE_', 'structure_'], label: 'Structure ID' },
                        { attrs: ['EQUIP_FRAB', 'equip_frab'], label: 'Equipment FRAB' },
                        { attrs: ['LOCID', 'locid'], label: 'Location ID' },
                        { attrs: ['GPSLATITUD', 'gpslatitud'], label: 'GPS Latitude' },
                        { attrs: ['GPSLONGITU', 'gpslongitu'], label: 'GPS Longitude' }
                    ];

                    // Add Pole fields (excluding latitude/longitude as we add Coordinates/Maps Link)
                    const poleFields = [
                        { attr: 'wmElementN', label: 'Pole ID' }
                    ];

                    // Add Slack Loop fields
                    const slackLoopFields = [
                        { attr: 'structure', label: 'Structure ID' },
                        { attr: 'type', label: 'Type' },
                        { attr: 'cable', label: 'Cable' },
                        { attr: 'length', label: 'Length (ft)' }
                    ];

                    // Add Node Site fields
                    const nodeSiteFields = [
                        { attr: 'Name', label: 'Site Name' }
                    ];

                    // Add Splitter fields  
                    const splitterFields = [
                        { attr: 'STRUCTURE_', label: 'Structure ID' },
                        { attr: 'CLLI', label: 'CLLI Code' },
                        { attr: 'EQUIP_FRAB', label: 'Equipment FRAB' },
                        { attr: 'OUTPUTPORT', label: 'Output Port Count' }
                    ];

                    // Determine which field set to use based on available attributes
                    // Check both uppercase and lowercase field names
                    const hasMSTFields = attrs.CLLI || attrs.STRUCTURE_ || attrs.MODELNUMBE ||
                        attrs.distributi || attrs.equipmentn || attrs.modelnumbe;
                    const isMST = (attrs.MODELNUMBE && attrs.MODELNUMBE.toString().includes('MST')) ||
                        (attrs.modelnumbe && attrs.modelnumbe.toString().includes('MST'));
                    const isPole = attrs.wmElementN !== undefined;
                    const isSlackLoop = attrs.structure !== undefined || attrs.type !== undefined || attrs.cable !== undefined;

                    let fieldsToUse = subscriberFields;
                    if (isPole) {
                        fieldsToUse = poleFields;
                    } else if (isSlackLoop) {
                        fieldsToUse = slackLoopFields;
                    } else if (hasMSTFields) {
                        if (isMST) {
                            fieldsToUse = mstTerminalFields;
                        } else {
                            fieldsToUse = splitterFields;
                        }
                    } else if (attrs.Name && !attrs.account) {
                        fieldsToUse = nodeSiteFields;
                    }

                    fieldsToUse.forEach(field => {
                        // Try all possible attribute name variations (case-insensitive)
                        let value;
                        if (field.attrs) {
                            // MST Terminal fields with multiple possible names
                            for (const attrName of field.attrs) {
                                if (attrs[attrName] !== undefined) {
                                    value = attrs[attrName];
                                    break;
                                }
                            }
                        } else {
                            // Standard fields with single attribute name
                            value = attrs[field.attr];
                        }

                        let displayValue;

                        if (value === null || value === undefined || value === '') {
                            displayValue = 'Not Available in Dataset';
                        } else {
                            // Format outputport as integer for MST terminals
                            if (field.label === 'Output Port Count' && typeof value === 'number') {
                                displayValue = Math.round(value).toString();
                            } else {
                                displayValue = value.toString().trim() || 'Not Available in Dataset';
                            }
                        }

                        data.push(`${field.label}: ${displayValue}`);
                    });
                }
            }

            // Add timestamp and data note
            data.push(`\nCopied: ${new Date().toLocaleString()}`);
            data.push(`Note: "Not Available in Dataset" indicates information not provided in source data, not a system error.`);

            // Add coordinates if available
            const graphic = this.view.popup?.selectedFeature;
            if (graphic?.geometry) {
                const geometry = graphic.geometry;
                let latitude, longitude;

                // Handle different geometry types and coordinate systems
                if (geometry.type === 'point') {
                    // ArcGIS Point geometry uses x (longitude) and y (latitude) or longitude/latitude properties
                    longitude = geometry.longitude !== undefined ? geometry.longitude : geometry.x;
                    latitude = geometry.latitude !== undefined ? geometry.latitude : geometry.y;
                } else if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
                    // GeoJSON format: [longitude, latitude]
                    [longitude, latitude] = geometry.coordinates;
                }

                if (latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)) {
                    // Use 14 decimal places for coordinates to match popup display
                    data.push(`Coordinates: ${latitude.toFixed(14)}, ${longitude.toFixed(14)}`);
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                    data.push(`Maps Link: ${mapsUrl}`);
                }
            }

            return data.length > 0 ? data.join('\n') : null;

        } catch (error) {
            log.error('Error extracting popup data:', error);
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
            log.error('Fallback copy failed:', err);
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
            log.warn('No feature selected for metrics refresh');
            return;
        }

        const attributes = selectedFeature.attributes;
        const nodeSiteName = attributes.Name;

        if (!nodeSiteName) {
            log.warn('No node site name available for metrics refresh');
            return;
        }

        try {
            // Show loading indicator (may be null on mobile)
            const loadingToast = this.showLoadingToast('Refreshing metrics...', nodeSiteName);

            // Import the service dynamically
            const { nodeSiteMetricsService } = await import('./NodeSiteMetricsService.js');

            // Refresh the popup by closing and reopening it
            const geometry = selectedFeature.geometry;
            popup.close();

            // Small delay to ensure popup is closed
            setTimeout(() => {
                popup.open({
                    features: [selectedFeature]
                });

                // Remove loading toast (check for null on mobile)
                if (loadingToast && loadingToast.parentNode) {
                    loadingToast.parentNode.removeChild(loadingToast);
                }

                this.showSuccessToast('Metrics refreshed successfully', nodeSiteName);
            }, 100);

        } catch (error) {
            log.error('Error refreshing metrics:', error);
            // Remove loading toast on error (check for null on mobile)
            if (loadingToast && loadingToast.parentNode) {
                loadingToast.parentNode.removeChild(loadingToast);
            }
            this.showErrorToast('Failed to refresh metrics', error.message);
        }
    }

    // Handle track vehicle action
    async handleTrackVehicleAction() {
        try {
            const graphic = this.view.popup?.selectedFeature;
            if (!graphic || !graphic.geometry) {
                log.warn('No vehicle geometry available');
                return;
            }

            // Center the map on the vehicle
            await this.view.goTo({
                target: graphic.geometry,
                zoom: 16
            });

            this.showCopyFeedback('Tracking vehicle...');
        } catch (error) {
            log.error('Failed to track vehicle:', error);
            this.showCopyFeedback('Failed to track vehicle', 'error');
        }
    }

    // Loading toast with spinner
    showLoadingToast(message, nodeSiteName) {
        // Skip on mobile devices
        if (this.isMobileDevice()) {
            log.info(`📱 Mobile popup toast skipped: ${message} - ${nodeSiteName}`);
            return null;
        }

        const toast = document.createElement('calcite-notice');
        toast.setAttribute('kind', 'brand');
        toast.setAttribute('open', 'true');
        toast.setAttribute('icon', 'refresh');
        toast.style.cssText = `
            position: fixed;
            top: 120px;
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
        // Skip on mobile devices
        if (this.isMobileDevice()) {
            log.info(`📱 Mobile popup toast skipped: ${message} - ${nodeSiteName}`);
            return null;
        }

        const toast = document.createElement('calcite-notice');
        toast.setAttribute('kind', 'positive');
        toast.setAttribute('open', 'true');
        toast.setAttribute('icon', 'check-circle');
        toast.setAttribute('auto-close', 'true');
        toast.setAttribute('auto-close-duration', '3000');
        toast.style.cssText = `
            position: fixed;
            top: 120px;
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
        // Skip on mobile devices
        if (this.isMobileDevice()) {
            log.info(`📱 Mobile popup toast skipped: ${message}`);
            return null;
        }

        const toast = document.createElement('calcite-notice');
        toast.setAttribute('kind', 'danger');
        toast.setAttribute('open', 'true');
        toast.setAttribute('icon', 'exclamation-mark-triangle');
        toast.setAttribute('auto-close', 'true');
        toast.setAttribute('auto-close-duration', '5000');
        toast.style.cssText = `
            position: fixed;
            top: 120px;
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