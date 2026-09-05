/** Extracted arrival policy: panel visibility is independent of engine layer state. */
export function collapseInitialLayers(doc = document) {
  const panel = doc.querySelector('.scada-wrapper');
  const toggle = doc.getElementById('gridatlas-dash-toggle');
  if (!panel || !toggle) return false;
  if (panel.getAttribute('data-gridatlas-collapsed') !== '1') toggle.click();
  doc.documentElement.dataset.codexLayersArrival = 'collapsed';
  return true;
}
export function mountLayersPanelPolicy(doc = document) {
  if (doc.documentElement.dataset.codexLayersArrival) return () => {};
  if (collapseInitialLayers(doc)) return () => {};
  const observer = new MutationObserver(() => {
    if (collapseInitialLayers(doc)) { observer.disconnect(); clearTimeout(timer); }
  });
  const timer = setTimeout(() => observer.disconnect(), 60000);
  observer.observe(doc.body, {childList:true,subtree:true});
  return () => { clearTimeout(timer); observer.disconnect(); };
}
