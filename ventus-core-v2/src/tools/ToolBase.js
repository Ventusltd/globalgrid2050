/**
 * TODO Phase 2: Tool Base Class
 * See ARCHITECTURE_V2.md Section 5
 * 
 * Purpose: Abstract interface for all tools
 * 
 * Contract:
 * - enable()
 * - disable()
 * - dispose()
 * - onMapClick(e)
 * - onMapMove(e)
 * - onKeyDown(e)
 */

export class ToolBase {
  constructor(context) {
    this.context = context;
    this.listeners = [];
    this.abortController = null;
  }

  enable() {
    throw new Error('Tool.enable() must be implemented');
  }

  disable() {
    throw new Error('Tool.disable() must be implemented');
  }

  dispose() {
    throw new Error('Tool.dispose() must be implemented');
  }
}
