import { calculateArea } from '../../../src/geometry/area.js';

describe('calculateArea', () => {
  test('calculates area of 1° × 1° square at equator', () => {
    // 1° × 1° square at equator
    const coords = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const area = calculateArea(coords);
    // Expected: ~12,365 km²
    expect(area).toBeCloseTo(12365, -2); // Within 100 km²
  });

  test('returns 0 for less than 3 points', () => {
    expect(calculateArea([[0, 0], [1, 1]])).toBe(0);
    expect(calculateArea([[0, 0]])).toBe(0);
    expect(calculateArea([])).toBe(0);
  });

  test('calculates triangle area', () => {
    // Triangle at equator
    const coords = [[0, 0], [1, 0], [0.5, 1]];
    const area = calculateArea(coords);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(15000); // Sanity check
  });

  test('handles clockwise and counter-clockwise winding', () => {
    const cw = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const ccw = [[0, 0], [0, 1], [1, 1], [1, 0]];
    const areaCW = calculateArea(cw);
    const areaCCW = calculateArea(ccw);
    // Both should give same absolute area
    expect(Math.abs(areaCW - areaCCW)).toBeLessThan(1);
  });

  test('calculates large polygon area', () => {
    // Rough square around UK (10° × 10°)
    const coords = [
      [-10, 50], [0, 50], [0, 60], [-10, 60]
    ];
    const area = calculateArea(coords);
    expect(area).toBeGreaterThan(500000); // > 500k km²
  });
});
