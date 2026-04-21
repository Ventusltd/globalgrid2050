/**
 * Logger - Phase 1.5
 * Simple logging wrapper with levels and timestamps
 * Production version can be swapped for Winston, Pino, etc.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

export class Logger {
  constructor(options = {}) {
    this.level = options.level !== undefined ? options.level : LOG_LEVELS.INFO;
    this.prefix = options.prefix || 'VentusCore';
  }

  /**
   * Log debug message (verbose details for development)
   */
  debug(message, context = {}) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      this._log('DEBUG', message, context);
    }
  }

  /**
   * Log informational message (normal operations)
   */
  info(message, context = {}) {
    if (this.level <= LOG_LEVELS.INFO) {
      this._log('INFO', message, context);
    }
  }

  /**
   * Log warning message (recoverable issues)
   */
  warn(message, context = {}) {
    if (this.level <= LOG_LEVELS.WARN) {
      this._log('WARN', message, context);
    }
  }

  /**
   * Log error message (failures requiring attention)
   */
  error(message, context = {}) {
    if (this.level <= LOG_LEVELS.ERROR) {
      this._log('ERROR', message, context);
    }
  }

  /**
   * Internal log formatter
   */
  _log(level, message, context) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.prefix}] [${level}]`;

    if (Object.keys(context).length > 0) {
      console.log(`${prefix} ${message}`, context);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Set log level dynamically
   */
  setLevel(level) {
    if (typeof level === 'string') {
      this.level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    } else {
      this.level = level;
    }
  }
}

// Export log levels for external use
export { LOG_LEVELS };
