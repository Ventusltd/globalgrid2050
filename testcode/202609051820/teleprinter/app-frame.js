import html2canvas from './vendor/html2canvas-1.4.1.mjs';

/** App-only rendering. No browser chrome, display permission or host binding. */
export async function captureAppFrame() {
  await document.fonts?.ready;
  const width = innerWidth, height = innerHeight, ratio = devicePixelRatio || 1;
  if (width * height * ratio * ratio > 40000000) throw new Error('This app view is too large to print at full resolution.');
  const canvases = [...document.querySelectorAll('canvas')];
  const images = new Map();
  const readCanvases = () => {
    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i], rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width) {
        images.set(i, canvas.toDataURL('image/png'));
      }
    }
  };
  const map = window.__GRIDATLAS_V9_MAP__;
  if (map?.once && map?.triggerRepaint) {
    await new Promise((resolve, reject) => {
      const done = () => { clearTimeout(timer); try { readCanvases(); resolve(); } catch (error) { reject(error); } };
      const timer = setTimeout(() => { map.off?.('render', done); reject(new Error('The map did not finish drawing. Try Print PDF again.')); }, 5000);
      map.once('render', done); map.triggerRepaint();
    });
  } else await new Promise((resolve, reject) => requestAnimationFrame(() => { try { readCanvases(); resolve(); } catch(error) { reject(error); } }));
  const output = await html2canvas(document.body, {
    width, height, x: scrollX, y: scrollY, windowWidth: width, windowHeight: height,
    scale: ratio, useCORS: true, allowTaint: false, logging: false,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    onclone: async cloned => {
      const imageReady = [];
      const liveMenu = document.getElementById('gridatlas-menu-bar');
      const clonedMenu = cloned.getElementById('gridatlas-menu-bar');
      if (liveMenu && clonedMenu) {
        // The live fixed bar extends outside its overflow-clipped map parent.
        // Preserve its viewport rectangle outside that clone clipping context.
        const r = liveMenu.getBoundingClientRect();
        cloned.body.append(clonedMenu);
        Object.assign(clonedMenu.style, {position:'fixed', left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px', margin:'0'});
      }
      [...cloned.querySelectorAll('canvas')].forEach((canvas, i) => {
        if (!images.has(i)) return;
        const image = cloned.createElement('img');
        for (const attr of canvas.attributes) image.setAttribute(attr.name, attr.value);
        image.src = images.get(i); image.width = canvas.width; image.height = canvas.height;
        canvas.replaceWith(image);
        imageReady.push(image.decode());
      });
      // html2canvas does not clone shadow roots. Preserve the visible File menu.
      const source = document.querySelector('#codex-teleprinter');
      const target = cloned.querySelector('#codex-teleprinter');
      if (source?.shadowRoot && target) {
        const wrapper = cloned.createElement('div');
        wrapper.id = target.id;
        wrapper.innerHTML = source.shadowRoot.innerHTML.replaceAll(':host', '#codex-teleprinter');
        wrapper.querySelectorAll('dialog:not([open])').forEach(node => node.remove());
        target.replaceWith(wrapper);
      }
      await Promise.all(imageReady);
    }
  });
  const actualWidth = Math.round(width * ratio), actualHeight = Math.round(height * ratio);
  if (output.width !== actualWidth || output.height !== actualHeight) throw new Error('The app print dimensions changed during capture.');
  return {width: output.width, height: output.height,
    rgba: output.getContext('2d').getImageData(0, 0, output.width, output.height).data,
    captureInfo: {instrument: 'app-dom-and-canvas', width, height, devicePixelRatio: ratio, canvasCount: images.size, canvasBytes: [...images.values()].map(s=>s.length), screenSharing: false}};
}
