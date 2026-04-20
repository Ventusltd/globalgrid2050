/**
 * TODO Phase 2: Plugin API
 * See ARCHITECTURE_V2.md Section 10
 */
export class VentusPlugin {
  constructor(id, options) {
    this.id = id;
    this.options = options;
  }

  init(context) {
    throw new Error('Plugin.init() must be implemented');
  }

  dispose() {
    throw new Error('Plugin.dispose() must be implemented');
  }
}
