// ============================================
// Logger Utility
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatMessage(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    if (this.isDevelopment) {
      return `${prefix} ${entry.message}`;
    }
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    const formatted = this.formatMessage(entry);
    
    switch (level) {
      case 'debug':
        if (this.isDevelopment) console.debug(formatted, data || '');
        break;
      case 'info':
        console.info(formatted, data || '');
        break;
      case 'warn':
        console.warn(formatted, data || '');
        break;
      case 'error':
        console.error(formatted, data || '');
        break;
    }
  }

  debug(message: string, data?: unknown) {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown) {
    this.log('error', message, data);
  }
}

export const logger = new Logger();
