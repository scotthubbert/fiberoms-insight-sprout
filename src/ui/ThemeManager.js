// ThemeManager.js - Handles theme switching and related UI updates

// Basemap configuration by theme
const BASEMAP_CONFIG = {
    light: {
        primary: 'streets',
        alternate: 'hybrid'
    },
    dark: {
        primary: 'streets-night-vector',
        alternate: 'hybrid'
    }
};

export class ThemeManager {
    constructor() {
        // Clean up any existing stored theme preferences
        localStorage.removeItem('theme');

        // Always follow system preference - no stored user preferences
        this.currentTheme = this.getSystemPreference();
        this.init();
    }

    getSystemPreference() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    async init() {
        await customElements.whenDefined('calcite-button');
        this.themeToggle = document.getElementById('theme-toggle');

        if (this.themeToggle) {
            this.applyTheme(this.currentTheme);
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

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateToggleIcon(theme);

        const isDark = theme === 'dark';
        document.body.classList.toggle('calcite-mode-dark', isDark);

        // Toggle ArcGIS theme stylesheets (official Esri pattern)
        const lightStylesheet = document.getElementById('esri-theme-light');
        const darkStylesheet = document.getElementById('esri-theme-dark');

        if (lightStylesheet && darkStylesheet) {
            lightStylesheet.disabled = isDark;
            darkStylesheet.disabled = !isDark;
        }

        // Update ArcGIS map components theme
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.setAttribute('theme', theme);
            const themeBasemaps = BASEMAP_CONFIG[theme];
            mapElement.setAttribute('basemap', themeBasemaps.primary);

            const basemapToggle = mapElement.querySelector('arcgis-basemap-toggle');
            if (basemapToggle) {
                basemapToggle.setAttribute('next-basemap', themeBasemaps.alternate);
            }

            const widgets = mapElement.querySelectorAll('arcgis-search, arcgis-zoom, arcgis-home, arcgis-locate, arcgis-basemap-toggle, arcgis-basemap-gallery, arcgis-expand, arcgis-track, arcgis-fullscreen');
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

