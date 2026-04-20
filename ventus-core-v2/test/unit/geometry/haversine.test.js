import { haversine } from '../../../src/geometry/haversine.js';

describe('haversine', () => {
  test('calculates distance between London and Paris', () => {
    // London: 51.5074°N, 0.1278°W
    // Paris: 48.8566°N, 2.3522°E
    // Expected: ~344 km
    const distance = haversine(-0.1278, 51.5074, 2.3522, 48.8566);
    expect(distance).toBeCloseTo(344, 0); // Within 1 km
  });

  test('returns 0 for same point', () => {
    const distance = haversine(0, 0, 0, 0);
    expect(distance).toBe(0);
  });

  test('handles antipodal points (maximum distance)', () => {
    // Maximum distance on Earth (half circumference)
    // 0°N,0°E to 0°N,180°W
    const distance = haversine(0, 0, 180, 0);
    expect(distance).toBeCloseTo(20037.508, 1); // Within 100m
  });

  test('calculates short distances accurately', () => {
    // 1 degree longitude at equator ≈ 111.32 km
    const distance = haversine(0, 0, 1, 0);
    expect(distance).toBeCloseTo(111.32, 1);
  });

  test('handles southern hemisphere', () => {
    // Sydney to Melbourne
    const distance = haversine(151.2093, -33.8688, 144.9631, -37.8136);
    expect(distance).toBeCloseTo(714, 0);
  });
});
