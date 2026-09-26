export function committedJsonItemsV9_7(payload, adapter) {
  if (adapter?.kind !== "committed-json-snapshot" || !adapter.input_collection) {
    throw new Error("unsupported or incomplete V9.7 source adapter");
  }
  const items = payload?.[adapter.input_collection];
  if (!Array.isArray(items)) throw new Error(`missing source collection ${adapter.input_collection}`);
  const required = ["headline", "url", "source", "published"];
  for (const [index, item] of items.entries()) {
    for (const field of required) {
      if (!String(item?.[field] || "").trim()) throw new Error(`source item ${index} missing ${field}`);
    }
  }
  return items;
}
