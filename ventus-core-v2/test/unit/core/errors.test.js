import { describe, test, expect } from '@jest/globals';
import {
  MapAdapterError,
  StateError,
  GeometryError,
  NetworkError,
  ToolError,
  ValidationError
} from '../../../src/core/errors.js';

describe('Error Classes', () => {
  test('MapAdapterError has correct name and message', () => {
    const error = new MapAdapterError('Container not found');
    expect(error.name).toBe('MapAdapterError');
    expect(error.message).toBe('Container not found');
    expect(error instanceof Error).toBe(true);
  });

  test('StateError has correct name and message', () => {
    const error = new StateError('Invalid action type');
    expect(error.name).toBe('StateError');
    expect(error.message).toBe('Invalid action type');
    expect(error instanceof Error).toBe(true);
  });

  test('GeometryError has correct name and message', () => {
    const error = new GeometryError('Invalid coordinates');
    expect(error.name).toBe('GeometryError');
    expect(error.message).toBe('Invalid coordinates');
    expect(error instanceof Error).toBe(true);
  });

  test('NetworkError has correct name and message', () => {
    const error = new NetworkError('Fetch failed');
    expect(error.name).toBe('NetworkError');
    expect(error.message).toBe('Fetch failed');
    expect(error instanceof Error).toBe(true);
  });

  test('ToolError has correct name and message', () => {
    const error = new ToolError('Tool activation failed');
    expect(error.name).toBe('ToolError');
    expect(error.message).toBe('Tool activation failed');
    expect(error instanceof Error).toBe(true);
  });

  test('ValidationError has correct name and message', () => {
    const error = new ValidationError('Invalid input');
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Invalid input');
    expect(error instanceof Error).toBe(true);
  });

  test('ValidationError stores field information', () => {
    const error = new ValidationError('Zoom out of range', 'zoom');
    expect(error.field).toBe('zoom');
  });

  test('ValidationError field defaults to null', () => {
    const error = new ValidationError('Generic validation error');
    expect(error.field).toBe(null);
  });
});
