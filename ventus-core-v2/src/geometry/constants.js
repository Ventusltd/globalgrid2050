/**
 * Geometry constants (WGS84 Earth model)
 */

// WGS84 equatorial radius (km)
export const EARTH_RADIUS_KM = 6378.137;

// Maximum radius (half Earth circumference in km)
export const MAX_RADIUS_KM = Math.PI * EARTH_RADIUS_KM; // 20037.508 km

// Conversion constants
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
