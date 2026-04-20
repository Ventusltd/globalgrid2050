import { AbortManager } from '../../../src/network/abort.js';

describe('AbortManager', () => {
  test('creates controller and returns signal', () => {
    const manager = new AbortManager();
    const controller = manager.createController('layer-solar');

    expect(controller).toBeInstanceOf(AbortController);
    expect(manager.getSignal('layer-solar')).toBe(controller.signal);
  });

  test('returns null signal for non-existent controller', () => {
    const manager = new AbortManager();
    expect(manager.getSignal('nonexistent')).toBeNull();
  });

  test('aborts specific controller', () => {
    const manager = new AbortManager();
    const controller = manager.createController('test');
    const signal = controller.signal;

    manager.abort('test');

    expect(signal.aborted).toBe(true);
    expect(manager.getSignal('test')).toBeNull();
  });

  test('abortAll cancels all controllers', () => {
    const manager = new AbortManager();

    const ctrl1 = manager.createController('layer1');
    const ctrl2 = manager.createController('layer2');
    const ctrl3 = manager.createController('layer3');

    const signal1 = ctrl1.signal;
    const signal2 = ctrl2.signal;
    const signal3 = ctrl3.signal;

    manager.abortAll();

    expect(signal1.aborted).toBe(true);
    expect(signal2.aborted).toBe(true);
    expect(signal3.aborted).toBe(true);
    expect(manager.getSignal('layer1')).toBeNull();
    expect(manager.getSignal('layer2')).toBeNull();
    expect(manager.getSignal('layer3')).toBeNull();
  });

  test('createController cancels existing controller with same ID', () => {
    const manager = new AbortManager();

    const oldController = manager.createController('layer-solar');
    const oldSignal = oldController.signal;

    const newController = manager.createController('layer-solar');
    const newSignal = newController.signal;

    expect(oldSignal.aborted).toBe(true);
    expect(newSignal.aborted).toBe(false);
    expect(manager.getSignal('layer-solar')).toBe(newSignal);
  });

  test('abort does nothing for non-existent controller', () => {
    const manager = new AbortManager();

    // Should not throw
    expect(() => manager.abort('nonexistent')).not.toThrow();
  });

  test('tracks multiple controllers independently', () => {
    const manager = new AbortManager();

    manager.createController('layer1');
    manager.createController('layer2');
    manager.createController('layer3');

    expect(manager.controllers.size).toBe(3);

    manager.abort('layer2');

    expect(manager.controllers.size).toBe(2);
    expect(manager.getSignal('layer1')).not.toBeNull();
    expect(manager.getSignal('layer2')).toBeNull();
    expect(manager.getSignal('layer3')).not.toBeNull();
  });
});
