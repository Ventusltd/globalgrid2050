export function startPlugins(plugins) {
  const started = new Set();
  for (const plugin of plugins) {
    if (!plugin || typeof plugin.id !== "string" || typeof plugin.start !== "function") {
      throw new TypeError("Every V7 plugin requires an id and start function.");
    }
    if (started.has(plugin.id)) throw new Error(`Duplicate V7 plugin id: ${plugin.id}`);
    const missing = (plugin.dependsOn || []).filter((dependency) => !started.has(dependency));
    if (missing.length) throw new Error(`V7 plugin ${plugin.id} has unmet dependencies: ${missing.join(", ")}`);
    plugin.start();
    started.add(plugin.id);
  }
  return Object.freeze([...started]);
}
