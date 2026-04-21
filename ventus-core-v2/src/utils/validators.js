/**
 * Validators - Phase 1.5
 * Input validation for options and configurations
 */

import { ValidationError } from '../core/errors.js';

/**
 * Validate VentusMap options
 * @param {Object} options - User-provided options
 * @throws {ValidationError} If validation fails
 */
export function validateOptions(options = {}) {
  if (typeof options !== 'object' || options === null) {
    throw new ValidationError('Options must be an object');
  }

  // Validate center if provided
  if (options.center !== undefined) {
    if (!Array.isArray(options.center) || options.center.length !== 2) {
      throw new ValidationError('center must be [longitude, latitude] array', 'center');
    }
    const [lon, lat] = options.center;
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      throw new ValidationError('center coordinates must be numbers', 'center');
    }
    if (lon < -180 || lon > 180) {
      throw new ValidationError('longitude must be between -180 and 180', 'center');
    }
    if (lat < -90 || lat > 90) {
      throw new ValidationError('latitude must be between -90 and 90', 'center');
    }
  }

  // Validate zoom if provided
  if (options.zoom !== undefined) {
    if (typeof options.zoom !== 'number') {
      throw new ValidationError('zoom must be a number', 'zoom');
    }
    if (options.zoom < 0 || options.zoom > 22) {
      throw new ValidationError('zoom must be between 0 and 22', 'zoom');
    }
  }

  // Validate style if provided
  if (options.style !== undefined) {
    if (typeof options.style !== 'string' && (typeof options.style !== 'object' || Array.isArray(options.style) || options.style === null)) {
      throw new ValidationError('style must be a string URL or style object', 'style');
    }
  }

  return true;
}

/**
 * Validate layer configuration
 * @param {Object} config - Layer configuration
 * @throws {ValidationError} If validation fails
 */
export function validateLayerConfig(config) {
  if (typeof config !== 'object' || config === null) {
    throw new ValidationError('Layer config must be an object');
  }

  // id is required
  if (!config.id) {
    throw new ValidationError('Layer config must have an id', 'id');
  }
  if (typeof config.id !== 'string') {
    throw new ValidationError('Layer id must be a string', 'id');
  }

  // type is required
  if (!config.type) {
    throw new ValidationError('Layer config must have a type', 'type');
  }
  const validTypes = ['geojson', 'vector', 'raster'];
  if (!validTypes.includes(config.type)) {
    throw new ValidationError(`Layer type must be one of: ${validTypes.join(', ')}`, 'type');
  }

  // source is required for geojson/vector types
  if ((config.type === 'geojson' || config.type === 'vector') && !config.source) {
    throw new ValidationError('Layer config must have a source for geojson/vector types', 'source');
  }

  // visible must be boolean if provided
  if (config.visible !== undefined && typeof config.visible !== 'boolean') {
    throw new ValidationError('Layer visible must be a boolean', 'visible');
  }

  return true;
}

/**
 * Validate coordinates
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @throws {ValidationError} If validation fails
 */
export function validateCoordinates(lon, lat) {
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    throw new ValidationError('Coordinates must be numbers');
  }
  if (!isFinite(lon) || !isFinite(lat)) {
    throw new ValidationError('Coordinates must be finite numbers');
  }
  if (lon < -180 || lon > 180) {
    throw new ValidationError('Longitude must be between -180 and 180');
  }
  if (lat < -90 || lat > 90) {
    throw new ValidationError('Latitude must be between -90 and 90');
  }
  return true;
}

/**
 * Validate radius value
 * @param {number} radius - Radius in kilometers
 * @throws {ValidationError} If validation fails
 */
export function validateRadius(radius) {
  if (typeof radius !== 'number') {
    throw new ValidationError('Radius must be a number');
  }
  if (!isFinite(radius) || radius <= 0) {
    throw new ValidationError('Radius must be a positive finite number');
  }
  if (radius > 20037) {
    throw new ValidationError('Radius exceeds Earth half-circumference (20037 km)');
  }
  return true;
}
