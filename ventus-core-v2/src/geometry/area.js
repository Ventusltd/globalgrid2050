import { EARTH_RADIUS_KM, DEG_TO_RAD } from './constants.js';

/**
 * Calculate spherical polygon area using spherical excess formula
 * 
 * @param {Array<[number, number]>} coords - Array of [lon, lat] coordinate pairs
 * @returns {number} Area in square kilometers
 * 
 * @example
 * // 1° × 1° square at equator
 * calculateArea([[0, 0], [1, 0], [1, 1], [0, 1]]); // ~12,365 km²
 */
export function calculateArea(coords) {
  if (!coords || coords.length < 3) {
    return 0;
  }

  let area = 0;
  const R = EARTH_RADIUS_KM;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[j];

    const x1 = lon1 * DEG_TO_RAD;
    const y1 = lat1 * DEG_TO_RAD;
    const x2 = lon2 * DEG_TO_RAD;
    const y2 = lat2 * DEG_TO_RAD;

    area += (x2 - x1) * (2 + Math.sin(y1) + Math.sin(y2));
  }

  return Math.abs(area) * R * R / 2;
}
