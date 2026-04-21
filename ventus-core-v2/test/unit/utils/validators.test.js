import { describe, test, expect } from '@jest/globals';
import { validateOptions, validateLayerConfig, validateCoordinates, validateRadius } from '../../../src/utils/validators.js';
import { ValidationError } from '../../../src/core/errors.js';

describe('validateOptions', () => {
  test('accepts valid options', () => {
    expect(() => validateOptions({
      center: [-3.5, 54.0],
      zoom: 6,
      style: 'mapbox://styles/mapbox/dark-v10'
    })).not.toThrow();
  });

  test('accepts empty options', () => {
    expect(() => validateOptions({})).not.toThrow();
  });

  test('rejects non-object options', () => {
    expect(() => validateOptions(null)).toThrow(ValidationError);
    expect(() => validateOptions('invalid')).toThrow(ValidationError);
  });

  test('rejects invalid center format', () => {
    expect(() => validateOptions({ center: [1, 2, 3] })).toThrow(ValidationError);
    expect(() => validateOptions({ center: 'invalid' })).toThrow(ValidationError);
    expect(() => validateOptions({ center: ['1', '2'] })).toThrow(ValidationError);
  });

  test('rejects out-of-range coordinates', () => {
    expect(() => validateOptions({ center: [181, 0] })).toThrow(ValidationError);
    expect(() => validateOptions({ center: [-181, 0] })).toThrow(ValidationError);
    expect(() => validateOptions({ center: [0, 91] })).toThrow(ValidationError);
    expect(() => validateOptions({ center: [0, -91] })).toThrow(ValidationError);
  });

  test('rejects invalid zoom', () => {
    expect(() => validateOptions({ zoom: 'invalid' })).toThrow(ValidationError);
    expect(() => validateOptions({ zoom: -1 })).toThrow(ValidationError);
    expect(() => validateOptions({ zoom: 23 })).toThrow(ValidationError);
  });

  test('rejects invalid style type', () => {
    expect(() => validateOptions({ style: 123 })).toThrow(ValidationError);
    expect(() => validateOptions({ style: [] })).toThrow(ValidationError);
  });
});

describe('validateLayerConfig', () => {
  test('accepts valid geojson layer config', () => {
    expect(() => validateLayerConfig({
      id: 'test-layer',
      type: 'geojson',
      source: 'https://example.com/data.geojson',
      visible: true
    })).not.toThrow();
  });

  test('rejects missing id', () => {
    expect(() => validateLayerConfig({
      type: 'geojson',
      source: 'data.geojson'
    })).toThrow(ValidationError);
  });

  test('rejects missing type', () => {
    expect(() => validateLayerConfig({
      id: 'test',
      source: 'data.geojson'
    })).toThrow(ValidationError);
  });

  test('rejects invalid type', () => {
    expect(() => validateLayerConfig({
      id: 'test',
      type: 'invalid',
      source: 'data.geojson'
    })).toThrow(ValidationError);
  });

  test('rejects missing source for geojson type', () => {
    expect(() => validateLayerConfig({
      id: 'test',
      type: 'geojson'
    })).toThrow(ValidationError);
  });

  test('rejects invalid visible type', () => {
    expect(() => validateLayerConfig({
      id: 'test',
      type: 'geojson',
      source: 'data.geojson',
      visible: 'yes'
    })).toThrow(ValidationError);
  });
});

describe('validateCoordinates', () => {
  test('accepts valid coordinates', () => {
    expect(() => validateCoordinates(-0.1278, 51.5074)).not.toThrow();
    expect(() => validateCoordinates(0, 0)).not.toThrow();
    expect(() => validateCoordinates(180, 90)).not.toThrow();
    expect(() => validateCoordinates(-180, -90)).not.toThrow();
  });

  test('rejects non-number coordinates', () => {
    expect(() => validateCoordinates('0', 0)).toThrow(ValidationError);
    expect(() => validateCoordinates(0, '0')).toThrow(ValidationError);
  });

  test('rejects non-finite coordinates', () => {
    expect(() => validateCoordinates(Infinity, 0)).toThrow(ValidationError);
    expect(() => validateCoordinates(0, NaN)).toThrow(ValidationError);
  });

  test('rejects out-of-range coordinates', () => {
    expect(() => validateCoordinates(181, 0)).toThrow(ValidationError);
    expect(() => validateCoordinates(-181, 0)).toThrow(ValidationError);
    expect(() => validateCoordinates(0, 91)).toThrow(ValidationError);
    expect(() => validateCoordinates(0, -91)).toThrow(ValidationError);
  });
});

describe('validateRadius', () => {
  test('accepts valid radius', () => {
    expect(() => validateRadius(10)).not.toThrow();
    expect(() => validateRadius(1000)).not.toThrow();
    expect(() => validateRadius(0.1)).not.toThrow();
  });

  test('rejects non-number radius', () => {
    expect(() => validateRadius('10')).toThrow(ValidationError);
  });

  test('rejects non-positive radius', () => {
    expect(() => validateRadius(0)).toThrow(ValidationError);
    expect(() => validateRadius(-10)).toThrow(ValidationError);
  });

  test('rejects non-finite radius', () => {
    expect(() => validateRadius(Infinity)).toThrow(ValidationError);
    expect(() => validateRadius(NaN)).toThrow(ValidationError);
  });

  test('rejects radius exceeding Earth half-circumference', () => {
    expect(() => validateRadius(20038)).toThrow(ValidationError);
  });
});
