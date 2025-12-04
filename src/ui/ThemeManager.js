// ThemeManager.js - Handles theme switching and related UI updates
//
// IMPORTANT: Theme is initially set by a blocking script in index.html <head>
// to prevent FOUC (Flash of Unstyled Content). This manager syncs with that
// initial state and handles subsequent theme changes.

import Basemap from '@arcgis/core/Basemap';
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('ThemeManager');

// Basemap configuration by theme
const BASEMAP_CONFIG = {
    light: {
        primary: 'streets-navigation-vector',
        alternate: 'hybrid',
        styleId: 'arcgis/navigation'
    },
    dark: {
        primary: 'streets-night-vector',
        alternate: 'hybrid',
        styleId: 'arcgis/navigation-night'
    }
};

export class ThemeManager {
    constructor() {
        // Clean up any existing stored theme preferences
        localStorage.removeItem('theme');

        // Sync with the theme already applied by the blocking script in <head>
        // This prevents any flash - the blocking script has already set the correct theme
        const initialTheme = document.documentElement.getAttribute('data-theme');
        this.currentTheme = initialTheme || this.getSystemPreference();
        
        log.info(`ThemeManager initialized with theme: ${this.currentTheme} (from ${initialTheme ? 'blocking script' : 'system preference'})`);
        this.init();
    }

    getSystemPreference() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    async init() {
        await customElements.whenDefined('calcite-button');
        this.themeToggle = document.getElementById('theme-toggle');

        if (this.themeToggle) {
            // Do not reapply theme synchronously; onViewReady will set style basemap
            this.themeToggle.addEventListener('click', () => this.toggleTheme());

            // Always listen for system theme changes
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addEventListener('change', (e) => {
                    const newTheme = e.matches ? 'dark' : 'light';
                    this.currentTheme = newTheme;
                    this.applyTheme(newTheme);
                });
            }
        }
    }

    async applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme-color meta for browser chrome (mobile address bar, etc.)
        const themeColorMeta = document.getElementById('theme-color-meta');
        if (themeColorMeta) {
            themeColorMeta.content = theme === 'dark' ? '#1a1a1a' : '#1976d2';
        }
        
        if (this.themeToggle) this.updateToggleIcon(theme);

        const isDark = theme === 'dark';
        
        // Update html element classes (syncs with blocking script in <head>)
        document.documentElement.classList.toggle('calcite-mode-dark', isDark);
        document.documentElement.classList.toggle('calcite-mode-light', !isDark);
        
        document.body.classList.toggle('calcite-mode-dark', isDark);

        // Toggle ArcGIS theme stylesheets (official Esri pattern)
        const lightStylesheet = document.getElementById('esri-theme-light');
        const darkStylesheet = document.getElementById('esri-theme-dark');

        if (lightStylesheet && darkStylesheet) {
            lightStylesheet.disabled = isDark;
            darkStylesheet.disabled = !isDark;
        }

        // Update ArcGIS map components theme and basemap
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.setAttribute('theme', theme);
            const themeBasemaps = BASEMAP_CONFIG[theme];

            // Prefer style-based basemap when view is available (requires API key)
            const view = window.mapView;
            let styleApplied = false;
            if (view && view.map && themeBasemaps.styleId) {
                try {
                    const basemap = new Basemap({ style: { id: themeBasemaps.styleId } });
                    view.map.basemap = basemap;
                    styleApplied = true;
                } catch (error) {
                    log.warn('Failed to apply style basemap, falling back to ID', error);
                }
            }

            // Fallback to ID-based basemap via component attribute
            if (!styleApplied) {
                mapElement.setAttribute('basemap', themeBasemaps.primary);
                const basemapToggle = mapElement.querySelector('arcgis-basemap-toggle');
                if (basemapToggle) {
                    basemapToggle.setAttribute('next-basemap', themeBasemaps.alternate);
                }
            }

            // Home is now a widget (not component), so it doesn't need theme attribute
            const widgets = mapElement.querySelectorAll('arcgis-search, arcgis-locate, arcgis-basemap-toggle, arcgis-basemap-gallery, arcgis-expand, arcgis-track, arcgis-fullscreen');
            widgets.forEach(widget => {
                widget.setAttribute('theme', theme);
            });

            // Apply theme to Esri widgets with delay
            setTimeout(() => {
                const esriElements = document.querySelectorAll('.esri-widget, .esri-search, .esri-popup, .esri-ui, .esri-view-surface');
                esriElements.forEach(element => {
                    element.classList.toggle('calcite-mode-dark', isDark);
                    element.classList.toggle('calcite-mode-light', !isDark);
                });
            }, 100);
        }

        if (window.mapView) {
            this.applyThemeToView(window.mapView);
        }

        // Update RainViewer layer for theme change
        if (window.app?.services?.rainViewerService) {
            window.app.services.rainViewerService.updateTheme();
        }
    }

    toggleTheme() {
        // Temporarily toggle theme - will revert to system preference when system changes or page refreshes
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
    }

    updateToggleIcon(theme) {
        const icon = theme === 'dark' ? 'brightness' : 'moon';
        const baseLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
        const statusLabel = ' (following system)';

        this.themeToggle.setAttribute('icon-start', icon);
        this.themeToggle.setAttribute('aria-label', baseLabel);
        this.themeToggle.setAttribute('title', baseLabel + statusLabel);
    }

    applyThemeToView(view) {
        if (!view) return;

        const isDark = this.currentTheme === 'dark';

        if (view.container) {
            view.container.classList.toggle('calcite-mode-dark', isDark);
            view.container.classList.toggle('calcite-mode-light', !isDark);
        }

        if (view.popup?.container) {
            view.popup.container.classList.toggle('calcite-mode-dark', isDark);
            view.popup.container.classList.toggle('calcite-mode-light', !isDark);
        }
    }
}

export default ThemeManager;

