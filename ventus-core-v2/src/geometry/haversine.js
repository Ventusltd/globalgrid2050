import { EARTH_RADIUS_KM, DEG_TO_RAD } from './constants.js';

/**
 * Calculate Haversine distance between two points on Earth
 * 
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @returns {number} Distance in kilometers
 * 
 * @example
 * // London to Paris
 * haversine(-0.1278, 51.5074, 2.3522, 48.8566); // ~344 km
 */
export function haversine(lon1, lat1, lon2, lat2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}
