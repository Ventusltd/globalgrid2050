import { screenPdf } from './screen-pdf.mjs';
import { decodePngPixels } from './png-pixels.mjs';

export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function imagePixels(blob) {
  const signature = new Uint8Array(await blob.slice(0,8).arrayBuffer());
  if (signature.length === 8 && signature.every((byte,index)=>byte===[137,80,78,71,13,10,26,10][index])) {
    const frame = await decodePngPixels(blob);
    if (frame) return frame;
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image could not be read. Choose a PNG screenshot.'));
      image.src = url;
    });
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height || width * height > 40000000) throw new Error('The screenshot is empty or too large.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    return { width, height, rgba: ctx.getImageData(0, 0, width, height).data };
  } finally { URL.revokeObjectURL(url); }
}

async function displayPixels() {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('This browser cannot capture its own screen. Take a screenshot on your device, then choose Print a screenshot.');
  const requestedWidth = Math.round(window.innerWidth * (window.devicePixelRatio || 1));
  const requestedHeight = Math.round(window.innerHeight * (window.devicePixelRatio || 1));
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1, width: { ideal: requestedWidth }, height: { ideal: requestedHeight } }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
  const track = stream.getVideoTracks()[0];
  const initial = track?.getSettings?.() || {};
  let video;
  let timeout;
  const pixels = (source, width, height, instrument) => {
    const current = track?.getSettings?.() || {};
    const trackWidth = Math.max(Number(initial.width) || 0, Number(current.width) || 0);
    const trackHeight = Math.max(Number(initial.height) || 0, Number(current.height) || 0);
    const currentTab = initial.displaySurface === 'browser' || current.displaySurface === 'browser';
    const requiredWidth = Math.max(trackWidth, currentTab ? requestedWidth : 0);
    const requiredHeight = Math.max(trackHeight, currentTab ? requestedHeight : 0);
    if (!width || !height || width > 14400 || height > 14400 || width * height > 40000000) throw new Error('The shared screen has no usable image.');
    if (width < requiredWidth || height < requiredHeight) {
      const error = new Error(`The browser supplied a reduced screen frame (${width} × ${height}; required ${requiredWidth} × ${requiredHeight}, track ${trackWidth} × ${trackHeight}). No reduced PDF was created. Use Print a screenshot instead.`);
      error.code = 'REDUCED_SCREEN_FRAME';
      throw error;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('The browser could not read the screen pixels.');
    ctx.drawImage(source, 0, 0);
    return { width, height, rgba: ctx.getImageData(0, 0, width, height).data, captureInfo: { instrument, requestedWidth, requestedHeight, trackWidth: trackWidth || null, trackHeight: trackHeight || null, currentTab, requestedViewportPixelsRetained: width >= requestedWidth && height >= requestedHeight } };
  };
  try {
    if (!track) throw new Error('The browser did not provide a screen video track.');
    try { track.contentHint = 'detail'; } catch { /* Optional browser hint, never evidence of pixel dimensions. */ }
    if (typeof globalThis.ImageCapture === 'function') {
      const directDeadline = Date.now() + 10000;
      while (Date.now() < directDeadline) {
      let bitmap, expired = false, directTimer;
      try {
        const pending = new ImageCapture(track).grabFrame().then(value => {
          if (expired) { value.close(); throw new Error('The direct screen frame arrived after its timeout.'); }
          return value;
        });
        bitmap = await Promise.race([pending, new Promise((_, reject) => { directTimer = setTimeout(() => { expired = true; reject(new Error('No direct screen frame arrived.')); }, Math.max(1, directDeadline - Date.now())); })]);
        return pixels(bitmap, bitmap.width, bitmap.height, 'ImageCapture.grabFrame');
      } catch (error) {
        if (error.code === 'REDUCED_SCREEN_FRAME' && Date.now() < directDeadline) {
          bitmap?.close(); bitmap = undefined;
          await new Promise(resolve => setTimeout(resolve, Math.min(100, directDeadline - Date.now())));
          continue;
        }
        // Engines without usable ImageCapture keep the guarded video path.
        break;
      } finally { expired = true; clearTimeout(directTimer); bitmap?.close(); }
      }
    }
    video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    await Promise.race([
      (async () => {
        await video.play();
        await new Promise(resolve => {
          if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(resolve);
          else requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
      })(),
      new Promise((_,reject) => { timeout = setTimeout(() => reject(new Error('No screen frame arrived. Try Print again.')), 10000); })
    ]);
    return pixels(video, video.videoWidth, video.videoHeight, 'HTMLVideoElement');
  } finally {
    clearTimeout(timeout);
    stream.getTracks().forEach(track => track.stop());
    if (video) { video.pause(); video.srcObject = null; }
  }
}

/** A host provider must return an actual browser screenshot; no DOM reconstruction. */
export async function printScreen({ capture, image, furniture, filename = 'teleprint-screen.pdf' } = {}) {
  let frame, method;
  if (image) { frame = await imagePixels(image); method = 'device-screenshot'; }
  else if (capture) { frame = await imagePixels(await capture()); method = 'browser-screenshot'; }
  else { frame = await displayPixels(); method = 'display-capture'; }
  const data = await screenPdf({ ...frame, furniture });
  const blob = new Blob([data], { type: 'application/pdf' });
  downloadFile(blob, filename);
  return { method, width: frame.width, height: frame.height, bytes: data.length, filename, status: 'download-requested', ...(frame.captureInfo ? { capture: frame.captureInfo } : {}) };
}
