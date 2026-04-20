import { URLCache } from '../../../src/network/cache.js';

describe('URLCache', () => {
  test('stores and retrieves data', () => {
    const cache = new URLCache();
    const testData = { features: [{ id: 1 }] };

    cache.set('/test.json', testData);
    const retrieved = cache.get('/test.json');

    expect(retrieved).toEqual(testData);
  });

  test('returns null for non-existent URL', () => {
    const cache = new URLCache();
    expect(cache.get('/nonexistent.json')).toBeNull();
  });

  test('evicts stale entries after TTL', async () => {
    const cache = new URLCache();
    cache.set('/test.json', { data: 'test' }, 100); // 100ms TTL

    // Should exist immediately
    expect(cache.get('/test.json')).not.toBeNull();

    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be evicted
    expect(cache.get('/test.json')).toBeNull();
  });

  test('custom TTL overrides default', () => {
    const cache = new URLCache();
    const now = Date.now();

    cache.set('/short.json', 'data', 1000); // 1 second
    cache.set('/long.json', 'data', 10000); // 10 seconds

    const shortEntry = cache.cache.get('/short.json');
    const longEntry = cache.cache.get('/long.json');

    expect(longEntry.expires - shortEntry.expires).toBeGreaterThan(8000);
  });

  test('evictStale removes only expired entries', async () => {
    const cache = new URLCache();

    cache.set('/fresh.json', 'fresh', 10000); // 10 seconds
    cache.set('/stale.json', 'stale', 50);    // 50ms

    await new Promise(resolve => setTimeout(resolve, 100));

    cache.evictStale();

    expect(cache.get('/fresh.json')).toBe('fresh');
    expect(cache.get('/stale.json')).toBeNull();
  });

  test('clear removes all entries', () => {
    const cache = new URLCache();
    cache.set('/test1.json', 'data1');
    cache.set('/test2.json', 'data2');

    cache.clear();

    expect(cache.get('/test1.json')).toBeNull();
    expect(cache.get('/test2.json')).toBeNull();
    expect(cache.cache.size).toBe(0);
  });

  test('overwrites existing URL', () => {
    const cache = new URLCache();
    cache.set('/test.json', 'old');
    cache.set('/test.json', 'new');

    expect(cache.get('/test.json')).toBe('new');
  });
});
