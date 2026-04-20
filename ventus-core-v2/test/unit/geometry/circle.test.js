import { createCircle } from '../../../src/geometry/circle.js';
import { haversine } from '../../../src/geometry/haversine.js';

describe('createCircle', () => {
  test('generates correct number of vertices', () => {
    const circle = createCircle(0, 0, 10, 64);
    expect(circle).toHaveLength(64);
  });

  test('all vertices are approximately correct distance from center', () => {
    const [lon, lat] = [0, 0];
    const radiusKm = 10;
    const circle = createCircle(lon, lat, radiusKm, 32);

    circle.forEach(([vLon, vLat]) => {
      const distance = haversine(lon, lat, vLon, vLat);
      expect(distance).toBeCloseTo(radiusKm, 2); // Within 10m (0.01 km)
    });
  });

  test('creates circle at high latitude', () => {
    // Test at 60°N (southern Norway)
    const circle = createCircle(10, 60, 50, 16);
    expect(circle).toHaveLength(16);

    circle.forEach(([vLon, vLat]) => {
      const distance = haversine(10, 60, vLon, vLat);
      expect(distance).toBeCloseTo(50, 1); // Within 1 km
    });
  });

  test('creates large circle (1000 km radius)', () => {
    const circle = createCircle(0, 0, 1000, 8);
    expect(circle).toHaveLength(8);

    const distance = haversine(0, 0, circle[0][0], circle[0][1]);
    expect(distance).toBeCloseTo(1000, 1);
  });

  test('creates small circle (1 km radius)', () => {
    const circle = createCircle(0, 0, 1, 8);
    expect(circle).toHaveLength(8);

    const distance = haversine(0, 0, circle[0][0], circle[0][1]);
    expect(distance).toBeCloseTo(1, 0.1);
  });

  test('handles negative longitude', () => {
    const circle = createCircle(-120, 45, 100, 16);
    expect(circle).toHaveLength(16);

    circle.forEach(([vLon, vLat]) => {
      const distance = haversine(-120, 45, vLon, vLat);
      expect(distance).toBeCloseTo(100, 1);
    });
  });
});
