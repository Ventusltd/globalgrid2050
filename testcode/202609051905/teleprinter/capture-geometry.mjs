/** Match the renderer's integer backing-store contract without rescaling pixels. */
export function captureGeometry(width, height, ratio) {
  if (![width, height, ratio].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid app print dimensions.');
  const pixelWidth = Math.floor(width * ratio), pixelHeight = Math.floor(height * ratio);
  if (!pixelWidth || !pixelHeight || pixelWidth * pixelHeight > 40000000) throw new Error('This app view is too large to print at full resolution.');
  return { width, height, ratio, pixelWidth, pixelHeight };
}

export function assertStableGeometry(before, after, frame) {
  if (before.width !== after.width || before.height !== after.height || before.ratio !== after.ratio) throw new Error('The app view resized during printing. Please try again.');
  if (frame.width !== before.pixelWidth || frame.height !== before.pixelHeight) throw new Error('The app renderer returned unexpected print dimensions.');
}
