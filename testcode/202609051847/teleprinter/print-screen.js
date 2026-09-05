import { screenPdf } from './screen-pdf.mjs';
import { decodePngPixels } from './png-pixels.mjs';
import { captureAppFrame } from './app-frame.js';

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

/** A host provider must return an actual browser screenshot; no DOM reconstruction. */
export async function printScreen({ capture, image, furniture, filename = 'teleprint-screen.pdf' } = {}) {
  let frame, method;
  if (image) { frame = await imagePixels(image); method = 'device-screenshot'; }
  else if (capture) { frame = await imagePixels(await capture()); method = 'browser-screenshot'; }
  else { frame = await captureAppFrame(); method = 'app-render'; }
  const data = await screenPdf({ ...frame, furniture });
  const blob = new Blob([data], { type: 'application/pdf' });
  downloadFile(blob, filename);
  return { method, width: frame.width, height: frame.height, bytes: data.length, filename, status: 'download-requested', ...(frame.captureInfo ? { capture: frame.captureInfo } : {}) };
}
