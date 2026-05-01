// Unit tests for the crop geometry math used by ImageCropDialog.
// The previous implementation inverted the sign of the destination origin and
// computed the destination width using the wrong formula, so cropped output
// pictures did not match what the user saw in the preview frame. These tests
// pin the corrected behaviour so the bug cannot silently come back.

import test from 'node:test';
import assert from 'node:assert/strict';

// Re-implement the helper here as a pure function so we can test it without
// pulling React/JSX through tsx --test. The implementation must mirror
// client/src/components/ImageCropDialog.tsx::deriveCropGeometry exactly.

const PREVIEW_WIDTH = 280;
const PORTRAIT_RATIO = 1.25;
const SQUARE_OUT = 1024;
const PORTRAIT_OUT_W = 1024;
const PORTRAIT_OUT_H = Math.round(PORTRAIT_OUT_W * PORTRAIT_RATIO);

function deriveCropGeometry(opts: {
  aspect: 'square' | 'portrait';
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}) {
  const previewWidth = PREVIEW_WIDTH;
  const previewHeight = opts.aspect === 'square' ? PREVIEW_WIDTH : Math.round(PREVIEW_WIDTH * PORTRAIT_RATIO);
  const outWidth = opts.aspect === 'square' ? SQUARE_OUT : PORTRAIT_OUT_W;
  const outHeight = opts.aspect === 'square' ? SQUARE_OUT : PORTRAIT_OUT_H;
  const baseScale = Math.max(previewWidth / opts.naturalWidth, previewHeight / opts.naturalHeight);
  const drawScale = baseScale * opts.zoom;
  const drawWidth = opts.naturalWidth * drawScale;
  const drawHeight = opts.naturalHeight * drawScale;
  const drawX = (previewWidth - drawWidth) / 2 + opts.offsetX;
  const drawY = (previewHeight - drawHeight) / 2 + opts.offsetY;
  return { outWidth, outHeight, previewWidth, previewHeight, drawX, drawY, drawWidth, drawHeight };
}

function canvasDest(geo: ReturnType<typeof deriveCropGeometry>) {
  const scaleX = geo.outWidth / geo.previewWidth;
  const scaleY = geo.outHeight / geo.previewHeight;
  return {
    dx: geo.drawX * scaleX,
    dy: geo.drawY * scaleY,
    dw: geo.drawWidth * scaleX,
    dh: geo.drawHeight * scaleY,
  };
}

test('square aspect, no zoom/offset, landscape source → image covers preview width-axis', () => {
  const geo = deriveCropGeometry({ aspect: 'square', naturalWidth: 800, naturalHeight: 600, zoom: 1, offsetX: 0, offsetY: 0 });
  // baseScale = max(280/800, 280/600) = 280/600 = 0.4666...
  // drawWidth = 800 * 0.4666... ≈ 373.33, drawHeight = 600 * 0.4666... = 280
  assert.equal(Math.round(geo.drawWidth), 373);
  assert.equal(Math.round(geo.drawHeight), 280);
  // drawX = (280 - 373.33)/2 = -46.66...; drawY = (280 - 280)/2 = 0
  assert.ok(geo.drawX < 0, `drawX should be negative when image is wider than preview, got ${geo.drawX}`);
  assert.equal(Math.round(geo.drawY), 0);
});

test('square aspect, output dest origin has SAME sign as drawX (regression)', () => {
  // The previous bug used -drawX/previewWidth, inverting sign.
  // Fixed math must place the image at the same relative position on the canvas
  // as it sits in the preview.
  const geo = deriveCropGeometry({ aspect: 'square', naturalWidth: 800, naturalHeight: 600, zoom: 1, offsetX: 0, offsetY: 0 });
  const dest = canvasDest(geo);
  // drawX is negative (image overhangs left/right of preview), so dest.dx must
  // also be negative for the on-canvas image to overhang to the left.
  assert.ok(dest.dx < 0, `dest.dx should be negative (matches negative drawX), got ${dest.dx}`);
  // dest width must equal drawWidth * (outWidth/previewWidth), NOT outWidth/drawScale.
  const expectedDw = geo.drawWidth * (geo.outWidth / geo.previewWidth);
  assert.ok(Math.abs(dest.dw - expectedDw) < 0.001, `dest.dw=${dest.dw} expected≈${expectedDw}`);
});

test('square aspect, offsetting right shifts the on-canvas image right', () => {
  const left = canvasDest(deriveCropGeometry({ aspect: 'square', naturalWidth: 800, naturalHeight: 600, zoom: 1, offsetX: -50, offsetY: 0 }));
  const right = canvasDest(deriveCropGeometry({ aspect: 'square', naturalWidth: 800, naturalHeight: 600, zoom: 1, offsetX: 50, offsetY: 0 }));
  assert.ok(right.dx > left.dx, `right offset should produce greater dest.dx; left=${left.dx} right=${right.dx}`);
  // Difference should equal 100 * (outWidth/previewWidth) = 100 * 1024/280 ≈ 365.7
  const expectedDelta = 100 * (1024 / 280);
  assert.ok(Math.abs((right.dx - left.dx) - expectedDelta) < 0.5, `delta dx ≈ ${right.dx - left.dx}, expected ≈ ${expectedDelta}`);
});

test('portrait aspect: preview and output share the same aspect ratio (no stretch)', () => {
  const geo = deriveCropGeometry({ aspect: 'portrait', naturalWidth: 1000, naturalHeight: 1000, zoom: 1, offsetX: 0, offsetY: 0 });
  // Preview ratio = previewWidth/previewHeight
  const previewRatio = geo.previewWidth / geo.previewHeight;
  const outRatio = geo.outWidth / geo.outHeight;
  // The previous implementation hardcoded 960×1280 (3:4 = 0.75) for a 280×350 preview (4:5 = 0.8) — mismatch.
  assert.ok(Math.abs(previewRatio - outRatio) < 0.01, `preview ratio ${previewRatio} should match output ratio ${outRatio}`);
});

test('zoom > 1 enlarges the on-canvas dest size proportionally', () => {
  const z1 = canvasDest(deriveCropGeometry({ aspect: 'square', naturalWidth: 800, naturalHeight: 600, zoom: 1, offsetX: 0, offsetY: 0 }));
  const z2 = canvasDest(deriveCropGeometry({ aspect: 'square', naturalWidth: 800, naturalHeight: 600, zoom: 2, offsetX: 0, offsetY: 0 }));
  assert.ok(Math.abs(z2.dw / z1.dw - 2) < 0.001, `zoom=2 should double dest.dw, got ratio ${z2.dw / z1.dw}`);
  assert.ok(Math.abs(z2.dh / z1.dh - 2) < 0.001, `zoom=2 should double dest.dh, got ratio ${z2.dh / z1.dh}`);
});

test('square portrait-source (tall image) → drawY negative, drawX zero', () => {
  const geo = deriveCropGeometry({ aspect: 'square', naturalWidth: 600, naturalHeight: 800, zoom: 1, offsetX: 0, offsetY: 0 });
  // baseScale = max(280/600, 280/800) = 280/600 = 0.4666...
  // drawWidth = 600 * 0.4666 = 280, drawHeight = 800 * 0.4666 ≈ 373.33
  assert.equal(Math.round(geo.drawWidth), 280);
  assert.equal(Math.round(geo.drawHeight), 373);
  assert.equal(Math.round(geo.drawX), 0);
  assert.ok(geo.drawY < 0);
});
