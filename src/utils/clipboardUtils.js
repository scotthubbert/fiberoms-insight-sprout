/**
 * Simple clipboard utility for copying individual popup fields
 */

/**
 * Copy text to clipboard with fallback support
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export async function copyToClipboard(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }

    try {
        // Modern clipboard API (preferred method)
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (err) {
        // Fallback to legacy execCommand method
        return fallbackCopyMethod(text);
    }

    // Final fallback
    return fallbackCopyMethod(text);
}

/**
 * Legacy fallback method for older browsers
 * @param {string} text - Text to copy
 * @returns {boolean} - Success status
 */
function fallbackCopyMethod(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = 'position: fixed; left: -999999px; opacity: 0;';
        document.body.appendChild(textArea);
        textArea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        return false;
    }
}

/**
 * Create a copy button for a specific field value
 * @param {any} value - Value to copy
 * @param {string} label - Field label for accessibility
 * @returns {HTMLElement} - Copy button element
 */
export function createCopyButton(value, label) {
    const copyButton = document.createElement('calcite-action');
    copyButton.setAttribute('icon', 'duplicate');
    copyButton.setAttribute('scale', 's');
    copyButton.setAttribute('text', `Copy ${label}`);
    copyButton.style.cssText = `
        --calcite-action-color: var(--calcite-color-text-3);
        cursor: pointer;
        margin-left: 8px;
    `;

    copyButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const success = await copyToClipboard(String(value));

        if (success) {
            // Success feedback
            copyButton.setAttribute('icon', 'check');
            copyButton.style.setProperty('--calcite-action-color', 'var(--calcite-color-status-success)');

            setTimeout(() => {
                copyButton.setAttribute('icon', 'duplicate');
                copyButton.style.setProperty('--calcite-action-color', 'var(--calcite-color-text-3)');
            }, 1500);
        } else {
            // Error feedback
            copyButton.setAttribute('icon', 'exclamation-mark-triangle');
            copyButton.style.setProperty('--calcite-action-color', 'var(--calcite-color-status-danger)');

            setTimeout(() => {
                copyButton.setAttribute('icon', 'duplicate');
                copyButton.style.setProperty('--calcite-action-color', 'var(--calcite-color-text-3)');
            }, 1500);
        }
    });

    return copyButton;
}

/**
 * Create enhanced popup content with copy buttons for each field
 * @param {Object} attributes - Feature attributes
 * @param {Array} fieldsConfig - Field configuration array
 * @returns {HTMLElement} - Popup content element
 */
export function createPopupWithCopyButtons(attributes, fieldsConfig) {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 0;';

    // Create table element
    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-family: var(--calcite-font-family);
        font-size: 0.875rem;
    `;

    fieldsConfig.forEach(fieldConfig => {
        const value = attributes[fieldConfig.fieldName];

        // Skip fields with no value
        if (!value || value === 'null' || value === '') {
            return;
        }

        // Format value based on field type
        let displayValue = value;
        if (fieldConfig.format && fieldConfig.format.dateFormat === 'short-date-short-time') {
            displayValue = new Date(value).toLocaleString();
        } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
        }

        // Create table row
        const row = document.createElement('tr');
        row.style.cssText = `
            border-bottom: 1px solid var(--calcite-color-border-3);
        `;

        // Create label cell
        const labelCell = document.createElement('td');
        labelCell.style.cssText = `
            padding: 12px 8px;
            font-weight: 600;
            color: var(--calcite-color-text-2);
            background-color: var(--calcite-color-foreground-2);
            border-right: 1px solid var(--calcite-color-border-3);
            white-space: nowrap;
            vertical-align: top;
            width: 30%;
        `;
        labelCell.textContent = fieldConfig.label;

        // Create value cell
        const valueCell = document.createElement('td');
        valueCell.style.cssText = `
            padding: 12px 8px;
            color: var(--calcite-color-text-1);
            word-break: break-word;
            vertical-align: top;
            position: relative;
        `;

        // Create value container
        const valueContainer = document.createElement('div');
        valueContainer.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 8px;
        `;

        // Create value text
        const valueText = document.createElement('span');
        valueText.style.cssText = 'flex: 1;';
        valueText.textContent = displayValue;

        // Create copy button
        const copyButton = createCopyButton(displayValue, fieldConfig.label);

        valueContainer.appendChild(valueText);
        valueContainer.appendChild(copyButton);
        valueCell.appendChild(valueContainer);

        row.appendChild(labelCell);
        row.appendChild(valueCell);
        table.appendChild(row);
    });

    container.appendChild(table);
    return container;
} 