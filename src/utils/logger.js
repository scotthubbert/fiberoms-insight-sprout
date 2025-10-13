// logger.js - Centralized logging utility for FiberOMS Insight
// Provides consistent logging across the entire application with environment-aware behavior

/**
 * Log levels in order of severity
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

/**
 * Logger class - provides structured, environment-aware logging
 */
class Logger {
    constructor(namespace = 'App') {
        this.namespace = namespace;
        this.isDevelopment = import.meta.env.DEV;

        // Set log level based on environment
        // In production: only WARN and ERROR
        // In development: all levels including DEBUG and INFO
        this.logLevel = this.isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
    }

    /**
     * Create a namespaced logger for better context
     * @param {string} namespace - The namespace/module name (e.g., 'DataService', 'MapController')
     * @returns {Logger} A new logger instance with the specified namespace
     */
    create(namespace) {
        return new Logger(namespace);
    }

    /**
     * Format log message with timestamp and namespace
     * @private
     */
    _format(level, ...args) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
        const prefix = `[${timestamp}] [${this.namespace}]`;
        return [prefix, ...args];
    }

    /**
     * Check if a log level should be output
     * @private
     */
    _shouldLog(level) {
        return level >= this.logLevel;
    }

    /**
     * Debug-level logging (development only, most verbose)
     * Use for detailed debugging information
     */
    debug(...args) {
        if (this._shouldLog(LOG_LEVELS.DEBUG)) {
            console.log(...this._format('DEBUG', ...args));
        }
    }

    /**
     * Info-level logging (development only)
     * Use for general informational messages
     */
    info(...args) {
        if (this._shouldLog(LOG_LEVELS.INFO)) {
            console.log(...this._format('INFO', ...args));
        }
    }

    /**
     * Warning-level logging (all environments)
     * Use for potentially problematic situations
     */
    warn(...args) {
        if (this._shouldLog(LOG_LEVELS.WARN)) {
            console.warn(...this._format('WARN', ...args));
        }
    }

    /**
     * Error-level logging (all environments)
     * Use for error conditions
     */
    error(...args) {
        if (this._shouldLog(LOG_LEVELS.ERROR)) {
            console.error(...this._format('ERROR', ...args));
        }
    }

    /**
     * Structured logging with context
     * Useful for logging objects with additional metadata
     */
    logWithContext(level, message, context = {}) {
        const logMethod = level === 'error' ? this.error :
            level === 'warn' ? this.warn :
                level === 'debug' ? this.debug : this.info;

        logMethod.call(this, message, context);
    }

    /**
     * Log a method call for debugging (development only)
     * Useful for tracing execution flow
     */
    trace(methodName, ...args) {
        if (this.isDevelopment && this._shouldLog(LOG_LEVELS.DEBUG)) {
            console.log(...this._format('TRACE', `${methodName}()`, ...args));
        }
    }

    /**
     * Group related log messages (development only)
     */
    group(label) {
        if (this.isDevelopment && this._shouldLog(LOG_LEVELS.DEBUG)) {
            console.group(...this._format('GROUP', label));
        }
    }

    groupEnd() {
        if (this.isDevelopment && this._shouldLog(LOG_LEVELS.DEBUG)) {
            console.groupEnd();
        }
    }
}

// Create and export default logger instance
export const logger = new Logger('App');

// Export factory function for creating namespaced loggers
export const createLogger = (namespace) => new Logger(namespace);

// Export for backward compatibility with existing log pattern
export const createLog = (namespace = 'App') => {
    const log = new Logger(namespace);
    return {
        info: (...args) => log.info(...args),
        warn: (...args) => log.warn(...args),
        error: (...args) => log.error(...args),
        debug: (...args) => log.debug(...args)
    };
};

// Default export
export default logger;

