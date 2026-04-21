import { describe, test, expect, jest } from '@jest/globals';
import { StateStore } from '../../../src/state/store.js';
import { setMapCenter, toggleLayer, setActiveTool } from '../../../src/state/actions.js';

describe('StateStore', () => {
  test('initializes with default state', () => {
    const store = new StateStore();
    const state = store.getState();

    expect(state.map).toBeDefined();
    expect(state.layers).toBeDefined();
    expect(state.tools).toBeDefined();
    expect(state.ui).toBeDefined();
    expect(state.network).toBeDefined();
  });

  test('dispatches action and updates state', () => {
    const store = new StateStore();

    store.dispatch(setMapCenter([-3.5, 54.0]));

    expect(store.getState().map.center).toEqual([-3.5, 54.0]);
  });

  test('notifies subscribers on state change', () => {
    const store = new StateStore();
    const callback = jest.fn();

    store.subscribe('map.center', callback);
    store.dispatch(setMapCenter([0, 0]));

    expect(callback).toHaveBeenCalledWith([0, 0]);
  });

  test('does not notify subscriber if value unchanged', () => {
    const store = new StateStore();
    const callback = jest.fn();

    store.subscribe('map.zoom', callback);

    // Dispatch action that doesn't change zoom
    store.dispatch(setMapCenter([0, 0]));

    expect(callback).not.toHaveBeenCalled();
  });

  test('multiple subscribers can watch same path', () => {
    const store = new StateStore();
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    store.subscribe('tools.active', callback1);
    store.subscribe('tools.active', callback2);

    store.dispatch(setActiveTool('radius'));

    expect(callback1).toHaveBeenCalledWith('radius');
    expect(callback2).toHaveBeenCalledWith('radius');
  });

  test('unsubscribe removes callback', () => {
    const store = new StateStore();
    const callback = jest.fn();

    const unsubscribe = store.subscribe('map.zoom', callback);
    unsubscribe();

    store.dispatch({ type: 'SET_MAP_ZOOM', payload: 10 });

    expect(callback).not.toHaveBeenCalled();
  });

  test('handles layer visibility toggle', () => {
    const store = new StateStore();

    store.dispatch(toggleLayer('solar', true));

    expect(store.getState().layers.visible.has('solar')).toBe(true);

    store.dispatch(toggleLayer('solar', false));

    expect(store.getState().layers.visible.has('solar')).toBe(false);
  });

  test('getState returns immutable copy', () => {
    const store = new StateStore();
    const state1 = store.getState();
    const state2 = store.getState();

    // Should be different objects (copies)
    expect(state1).not.toBe(state2);

    // But with same values
    expect(state1.map.center).toEqual(state2.map.center);
  });

  test('handles nested path subscription', () => {
    const store = new StateStore();
    const callback = jest.fn();

    store.subscribe('layers.stats', callback);

    store.dispatch({
      type: 'UPDATE_LAYER_STATS',
      payload: { layerId: 'solar', stats: { count: 100, mw: 500 } }
    });

    expect(callback).toHaveBeenCalled();
  });
});
