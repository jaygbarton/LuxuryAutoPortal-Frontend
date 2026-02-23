/**
 * Frontend Logger Utility
 * Provides consistent logging for the React application
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class FrontendLogger {
  private isDevelopment: boolean;
  private logLevel: LogLevel;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(level: string, message: string, context?: string): string {
    const timestamp = new Date().toLocaleTimeString();
    const ctx = context ? `[${context}]` : '[APP]';
    return `[${timestamp}] ${level.toUpperCase()} ${ctx} ${message}`;
  }

  error(message: string, context?: string, data?: any, error?: Error): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const formatted = this.formatMessage('error', message, context);
    console.error(formatted);
    
    if (data) console.error('Data:', data);
    if (error) console.error('Error:', error);
  }

  warn(message: string, context?: string, data?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const formatted = this.formatMessage('warn', message, context);
    console.warn(formatted);
    
    if (data) console.warn('Data:', data);
  }

  info(message: string, context?: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const formatted = this.formatMessage('info', message, context);
    console.info(formatted);
    
    if (data) console.info('Data:', data);
  }

  debug(message: string, context?: string, data?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const formatted = this.formatMessage('debug', message, context);
    console.log(formatted);
    
    if (data) console.log('Data:', data);
  }
}

export const logger = new FrontendLogger();

// Specialized context loggers
export const apiLogger = {
  error: (msg: string, data?: any, error?: Error) => logger.error(msg, 'API', data, error),
  warn: (msg: string, data?: any) => logger.warn(msg, 'API', data),
  info: (msg: string, data?: any) => logger.info(msg, 'API', data),
  debug: (msg: string, data?: any) => logger.debug(msg, 'API', data)
};

export const authLogger = {
  error: (msg: string, data?: any, error?: Error) => logger.error(msg, 'AUTH', data, error),
  warn: (msg: string, data?: any) => logger.warn(msg, 'AUTH', data),
  info: (msg: string, data?: any) => logger.info(msg, 'AUTH', data),
  debug: (msg: string, data?: any) => logger.debug(msg, 'AUTH', data)
};

export const uiLogger = {
  error: (msg: string, data?: any, error?: Error) => logger.error(msg, 'UI', data, error),
  warn: (msg: string, data?: any) => logger.warn(msg, 'UI', data),
  info: (msg: string, data?: any) => logger.info(msg, 'UI', data),
  debug: (msg: string, data?: any) => logger.debug(msg, 'UI', data)
};