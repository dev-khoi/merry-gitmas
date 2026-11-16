import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { validateSnapshot } from '../src/snapshot.js';
import { deriveTreeState } from '../src/tree-state.js';

const out = new URL('../output/', import.meta.url);
const artifacts = new URL('../test-output/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const png = await readFile(new URL('tree.png', out));
assert.equal(png.subarray(1, 4).toString(), 'PNG');
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
const gif = await readFile(new URL('tree.gif', out));
assert.equal(gif.subarray(0, 6).toString(), 'GIF89a');
assert.equal(gif.readUInt16LE(6), width);
assert.equal(gif.readUInt16LE(8), height);
assert.ok(gif.includes(Buffer.from('NETSCAPE2.0')), 'GIF must advertise looping');

// Walk real GIF blocks, including local palettes and compressed data. Counting
// arbitrary byte values would mistake image payload for frames or delays.
let offset = 13 + ((gif[10] & 0x80) ? 3 * 2 ** ((gif[10] & 7) + 1) : 0);
let frameCount = 0;
let totalDelay = 0;
function skipSubBlocks() {
  while (offset < gif.length) {
    const length = gif[offset++];
    if (!length) return;
    offset += length;
  }
  throw new Error('Truncated GIF sub-block');
}
while (offset < gif.length && gif[offset] !== 0x3b) {
  const marker = gif[offset++];
  if (marker === 0x21) {
    const type = gif[offset++];
    if (type === 0xf9) {
      assert.equal(gif[offset++], 4);
      totalDelay += gif.readUInt16LE(offset + 1);
      offset += 4;
      assert.equal(gif[offset++], 0);
    } else skipSubBlocks();
  } else if (marker === 0x2c) {
    const packed = gif[offset + 8];
    offset += 9;
    if (packed & 0x80) offset += 3 * 2 ** ((packed & 7) + 1);
    offset++; // LZW minimum code size
    skipSubBlocks();
    frameCount++;
  } else throw new Error(`Unexpected GIF marker ${marker} at ${offset - 1}`);
}
assert.equal(gif[offset], 0x3b, 'GIF must end in a trailer');
assert.ok(frameCount >= 24);
assert.equal(totalDelay, 2400, 'GIF must last exactly 24 seconds');
const snapshot = validateSnapshot(JSON.parse(await readFile(new URL('snapshot.json', out), 'utf8')));
assert.deepEqual(JSON.parse(await readFile(new URL('tree-state.json', out), 'utf8')), deriveTreeState(snapshot));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(new URL('preview.html', out).href);
  await page.waitForFunction(() => {
    const button = document.getElementById('pause');
    return button?.textContent === 'Pause' && Number((document.getElementById('time') as HTMLInputElement).value) > 0;
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const pausedValue = await page.getByRole('slider').inputValue();
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole('slider').inputValue(), pausedValue, 'Pause must stop time');
  await page.getByRole('slider').fill('6');
  assert.equal(await page.getByRole('slider').inputValue(), '6');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => Number((document.getElementById('time') as HTMLInputElement).value) > 6);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const decoded = await page.evaluate(async () => {
    const image = new Image(); image.src = 'tree.gif'; await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  assert.deepEqual(decoded, { width, height }, 'Browser must decode the exported GIF');
  const fidelity = await page.evaluate(async ({ encoded, state, frameCount, width, height }) => {
    const win = window as any;
    const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const decoder = new win.ImageDecoder({ data, type: 'image/gif' });
    await decoder.tracks.ready;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const scene = win.MerryGitmas.mount(canvas, state);
    const errors: number[] = [];
    for (const index of [0, Math.floor(frameCount / 4), frameCount - 1]) {
      const frame = await decoder.decode({ frameIndex: index });
      const decoded = new Uint8Array(canvas.width * canvas.height * 4);
      await frame.image.copyTo(decoded, { format: 'RGBA' });
      frame.image.close();
      scene.draw(index * 24 / frameCount);
      const expected = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let error = 0;
      for (let i = 0; i < expected.length; i++) error += Math.abs(expected[i] - decoded[i]);
      errors.push(error / expected.length);
    }
    decoder.close();
    return errors;
  }, { encoded: gif.toString('base64'), state: deriveTreeState(snapshot), frameCount, width, height });
  assert.ok(fidelity.every(error => error < 4), `Composited GIF frames must match the renderer within quantization tolerance: ${fidelity}`);
  await page.screenshot({ path: fileURLToPath(new URL('preview-desktop.png', artifacts)) });
  await page.setViewportSize({ width: 360, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile preview must not overflow');
  await page.screenshot({ path: fileURLToPath(new URL('preview-mobile.png', artifacts)), fullPage: true });
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(new URL('preview.html', out).href);
  await reduced.getByRole('button', { name: 'Play', exact: true }).waitFor();
  assert.equal(await reduced.getByRole('slider').inputValue(), '0');
  assert.ok((await page.locator('#font-license').textContent())?.includes('SIL OPEN FONT LICENSE'));
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [], 'Preview must not need external HTTP requests');
  console.log(`PASS: ${frameCount}-frame GIF (${(gif.length / 1024 / 1024).toFixed(2)} MiB), PNG ${width}×${height}, offline desktop/mobile preview, pause/scrub/play, and reduced motion.`);
} finally {
  await browser.close();
}
