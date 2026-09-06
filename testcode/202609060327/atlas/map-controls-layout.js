/** Layout-only successor: preserve the existing tool, Layers and menu handlers. */
export function mountMapControlsLayout(doc = document) {
  const style = doc.createElement('style');
  style.id = 'atlas-map-controls-layout';
  style.textContent = `
#codex-tool-layers{top:auto!important;right:12px!important;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 52px)!important;z-index:1000!important;gap:6px!important;max-width:calc(100vw - 24px)!important}
#codex-tool-layers>button{background:var(--atlas-control-bg,#0d1117)!important;color:var(--atlas-control-fg,#7fe3d0)!important;border:1px solid var(--atlas-control-border,#2b3a44)!important;border-radius:3px;font:600 12px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace!important;min-height:44px;cursor:pointer}
#codex-tool-layers>button:hover{filter:brightness(1.2)}
#codex-tool-layers>button:focus-visible{outline:2px solid var(--atlas-control-fg,#7fe3d0);outline-offset:2px}
body:has(#gridatlas-menu-bar button[aria-expanded="true"]) #codex-tool-layers{visibility:hidden!important;pointer-events:none!important}
html body .search-bar-wrapper[data-testcode-search="persistent"]{width:min(640px,calc(100vw - 32px))!important;max-width:calc(100vw - 32px)!important}
html body .search-bar-wrapper[data-testcode-search="persistent"]>div{flex:1!important;min-width:0!important}
html body .search-bar-wrapper[data-testcode-search="persistent"] #search-input{width:100%!important;box-sizing:border-box!important}
@media(max-width:768px){
 #gridatlas-menu-bar .gm-panel{top:54px!important;max-height:calc(100dvh - 60px)!important;box-sizing:border-box;z-index:1}
 #codex-tool-layers{flex-direction:column!important;align-items:stretch!important;max-width:min(250px,calc(100vw - 24px))!important}
 html body .search-bar-wrapper[data-testcode-search="persistent"]{width:calc(100vw - 24px)!important;max-width:calc(100vw - 24px)!important}
}
`;
  doc.head.append(style);
  function reflect() {
    const tray = doc.getElementById('codex-tool-layers');
    const layers = doc.getElementById('gridatlas-dash-toggle');
    if (tray && layers) {
      const colors = getComputedStyle(layers);
      tray.style.setProperty('--atlas-control-bg', colors.backgroundColor);
      tray.style.setProperty('--atlas-control-fg', colors.color);
      tray.style.setProperty('--atlas-control-border', colors.borderTopColor);
    }
    for (const link of doc.querySelectorAll('a[href*="/spider_printer"]')) {
      if (/spider\s*printer/i.test(link.textContent)) link.textContent = 'Elements';
    }
    const generation = window.location.pathname.match(/\/testcode\/(\d{12})\/atlas\//)?.[1];
    if (generation) for (const link of doc.querySelectorAll('a[href]')) {
      if (/^Test Code\s*·\s*\d{12}$/.test(link.textContent.trim()) && !link.textContent.includes(generation)) {
        const instant = new Date(`${generation.slice(0,4)}-${generation.slice(4,6)}-${generation.slice(6,8)}T${generation.slice(8,10)}:${generation.slice(10,12)}:00Z`);
        const ukTime = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(instant);
        link.textContent = 'Codex Atlas · ' + generation + ' UTC · ' + ukTime;
        link.title = 'Clear menus, tools above Layers, wider search, Elements';
        link.href = '/testcode/' + generation + '/';
      }
    }
  }
  const observer = new MutationObserver(reflect);
  observer.observe(doc.body, {childList:true,subtree:true});
  reflect();
  return () => { observer.disconnect(); style.remove(); };
}
