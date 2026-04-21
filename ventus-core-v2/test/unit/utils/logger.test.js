import { describe, test, expect, jest } from '@jest/globals';
import { Logger, LOG_LEVELS } from '../../../src/utils/logger.js';

describe('Logger', () => {
  test('creates logger with default level INFO', () => {
    const logger = new Logger();
    expect(logger.level).toBe(LOG_LEVELS.INFO);
  });

  test('creates logger with custom level', () => {
    const logger = new Logger({ level: LOG_LEVELS.DEBUG });
    expect(logger.level).toBe(LOG_LEVELS.DEBUG);
  });

  test('creates logger with custom prefix', () => {
    const logger = new Logger({ prefix: 'CustomPrefix' });
    expect(logger.prefix).toBe('CustomPrefix');
  });

  test('setLevel updates log level by string', () => {
    const logger = new Logger();
    logger.setLevel('DEBUG');
    expect(logger.level).toBe(LOG_LEVELS.DEBUG);
  });

  test('setLevel updates log level by number', () => {
    const logger = new Logger();
    logger.setLevel(3);
    expect(logger.level).toBe(LOG_LEVELS.ERROR);
  });

  test('setLevel handles invalid string gracefully', () => {
    const logger = new Logger();
    logger.setLevel('INVALID');
    expect(logger.level).toBe(LOG_LEVELS.INFO); // Falls back to INFO
  });

  test('logs at appropriate levels', () => {
    const logger = new Logger({ level: LOG_LEVELS.DEBUG });

    // These should not throw
    expect(() => logger.debug('Debug message')).not.toThrow();
    expect(() => logger.info('Info message')).not.toThrow();
    expect(() => logger.warn('Warn message')).not.toThrow();
    expect(() => logger.error('Error message')).not.toThrow();
  });

  test('logs with context object', () => {
    const logger = new Logger({ level: LOG_LEVELS.INFO });

    expect(() => logger.info('Message', { key: 'value' })).not.toThrow();
  });

  test('respects log level filtering', () => {
    const logger = new Logger({ level: LOG_LEVELS.NONE });

    // Should not throw even when logging is disabled
    expect(() => logger.debug('Should not log')).not.toThrow();
    expect(() => logger.info('Should not log')).not.toThrow();
    expect(() => logger.warn('Should not log')).not.toThrow();
    expect(() => logger.error('Should not log')).not.toThrow();
  });
});
