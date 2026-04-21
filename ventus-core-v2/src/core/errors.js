/**
 * Error Taxonomy - Phase 1.5
 * Defines specific error types for different failure modes
 */

/**
 * Thrown when map adapter operations fail
 * Examples: container not found, MapLibre initialization error, invalid map options
 */
export class MapAdapterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MapAdapterError';
  }
}

/**
 * Thrown when state operations fail
 * Examples: invalid action type, subscription path error, state mutation attempt
 */
export class StateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateError';
  }
}

/**
 * Thrown when geometry calculations fail
 * Examples: invalid coordinates, out-of-range values, NaN results
 */
export class GeometryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeometryError';
  }
}

/**
 * Thrown when network operations fail
 * Examples: fetch errors, cache errors, abort errors, URL parsing failures
 */
export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Thrown when tool operations fail
 * Examples: tool activation error, tool state corruption, invalid tool options
 */
export class ToolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * Thrown when validation fails
 * Examples: invalid options, missing required fields, type mismatches
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
