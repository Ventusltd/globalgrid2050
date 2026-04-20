import { EARTH_RADIUS_KM, DEG_TO_RAD, RAD_TO_DEG } from './constants.js';

/**
 * Generate geodesic circle using bearing projection method
 * 
 * @param {number} lon - Center longitude (degrees)
 * @param {number} lat - Center latitude (degrees)
 * @param {number} radiusKm - Radius in kilometers
 * @param {number} numPoints - Number of vertices to generate (default: 64)
 * @returns {Array<[number, number]>} Array of [lon, lat] coordinate pairs
 * 
 * @example
 * // 10 km circle around London with 32 vertices
 * createCircle(-0.1278, 51.5074, 10, 32);
 */
export function createCircle(lon, lat, radiusKm, numPoints = 64) {
  const coords = [];
  const angularDistance = radiusKm / EARTH_RADIUS_KM;
  const latRad = lat * DEG_TO_RAD;

  for (let i = 0; i < numPoints; i++) {
    const bearing = (i / numPoints) * 2 * Math.PI;

    // Calculate destination point using bearing projection
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const lon2 = lon * DEG_TO_RAD + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2)
    );

    coords.push([lon2 * RAD_TO_DEG, lat2 * RAD_TO_DEG]);
  }

  return coords;
}
