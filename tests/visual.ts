// Run the supplied HTML itself and compare it to the extracted grid renderer.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { createDemoSnapshot } from '../src/snapshot.js';
import { deriveTreeState } from '../src/tree-state.js';

const root = new URL('../', import.meta.url);
const out = new URL('../test-output/', import.meta.url);
await mkdir(out, { recursive: true });
const originalBytes = await readFile(new URL('vendor/original.html', root));
const provenance = JSON.parse(await readFile(new URL('vendor/source.json', root), 'utf8'));
assert.equal(createHash('sha256').update(originalBytes).digest('hex'), provenance.sha256);
const bundle = await readFile(new URL('dist/scene.js', root), 'utf8');
assert.doesNotMatch(bundle, /\bdrawFireworks\b|\bdrawSanta\b|\bchristmasCountdown\b/);
const font = (await readFile(new URL('dist/jetbrains-mono.woff2', root))).toString('base64');
const boldFont = (await readFile(new URL('dist/jetbrains-mono-bold.woff2', root))).toString('base64');
const fontCSS = `@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(data:font/woff2;base64,${font})}@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(data:font/woff2;base64,${boldFont})}`;
const times = [0, 3.5, 7, 12, 19];
const reports = [];

async function geometryBytes(page: Page, key: string) {
  return page.evaluate(key => Object.fromEntries(Object.entries((window as any)[key].geometry).map(([name, value]) => {
    const array = value as ArrayBufferView;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return [name, btoa(binary)];
  })), key) as Promise<Record<string, string>>;
}

async function pixels(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let binary = '';
    for (let i = 0; i < rgba.length; i += 32768) binary += String.fromCharCode(...rgba.subarray(i, i + 32768));
    return btoa(binary);
  });
}

const browser = await chromium.launch();
try {
  for (const [name, width, height] of [['portrait', 420, 457], ['landscape', 960, 640]] as const) {
    const sourcePage = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const extractedPage = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    for (const page of [sourcePage, extractedPage]) page.on('pageerror', error => errors.push(error.message));
    await sourcePage.addScriptTag({ content: 'window.requestAnimationFrame = () => 0;' });
    // No source geometry, font, lighting, or rendering statements are altered.
    // Expose the renderer after its own resize() and stop automatic scheduling.
    const expose = `window.upstream = { draw: render, geometry: {
      positions: scene.P, normals: scene.N, colors: scene.C, kinds: scene.K,
      reveal: scene.T, phases: scene.PH, shading: scene.SH, objects: scene.O
    }, count: scene.count };`;
    await sourcePage.setContent(originalBytes.toString('utf8').replace('    </script>', `${expose}\n    </script>`));
    await extractedPage.setContent(`<style>${fontCSS}</style><canvas width="${width}" height="${height}"></canvas>`);
    await extractedPage.addScriptTag({ content: bundle });
    await extractedPage.evaluate(async () => {
      await document.fonts.load('12px "JetBrains Mono"');
      await document.fonts.load('bold 12px "JetBrains Mono"');
      await document.fonts.ready;
      const win = window as any;
      win.extracted = win.MerryGitmas.createTreeRenderer(document.querySelector('canvas'), { reference: true });
    });
    const sourceGeometry = await geometryBytes(sourcePage, 'upstream');
    const extractedGeometry = await geometryBytes(extractedPage, 'extracted');
    assert.deepEqual(Object.keys(extractedGeometry), Object.keys(sourceGeometry));
    for (const field of Object.keys(sourceGeometry)) {
      assert.ok(extractedGeometry[field] === sourceGeometry[field], `${name}: original ${field} typed-array bytes differ`);
    }
    for (const time of times) {
      const dt = time === 0 ? 0 : 0.125;
      await sourcePage.evaluate(({ time, dt }) => (window as any).upstream.draw(time, time, dt), { time, dt });
      await extractedPage.evaluate(({ time, dt }) => (window as any).extracted.draw(time, 1, dt), { time, dt });
      const [original, extracted] = await Promise.all([pixels(sourcePage), pixels(extractedPage)]);
      assert.ok(original === extracted, `${name}: pixel parity failed at ${time}s`);
    }
    await sourcePage.locator('canvas').screenshot({ path: fileURLToPath(new URL(`original-${name}.png`, out)) });
    await extractedPage.locator('canvas').screenshot({ path: fileURLToPath(new URL(`extracted-${name}.png`, out)) });
    const state = deriveTreeState(createDemoSnapshot());
    const personalized = await extractedPage.evaluate(state => {
      const canvas = document.querySelector('canvas')!;
      const renderer = (window as any).MerryGitmas.createTreeRenderer(canvas, { seed: state.seed, state, fontFamily: '"JetBrains Mono", monospace' });
      const images = [0, 6, 24, 0].map(time => { renderer.draw(time); return canvas.toDataURL(); });
      return { images, counts: renderer.counts, weekLights: renderer.weekLights };
    }, state);
    assert.equal(personalized.images[0], personalized.images[2], 'Loop endpoints must match, including snowfall');
    assert.equal(personalized.images[0], personalized.images[3], 'Frame order must not change snow or lighting');
    assert.notEqual(personalized.images[0], personalized.images[1], 'The tree and snowfall must animate');
    assert.equal(personalized.counts.ornaments, 26);
    assert.equal(personalized.counts.gifts, 5);
    assert.ok(personalized.counts.flakes >= 380);
    assert.equal(personalized.counts.lights, state.weeks.length);
    assert.equal(new Set(personalized.weekLights.map((week: { index: number }) => week.index)).size, state.weeks.length);
    assert.equal(personalized.weekLights.reduce((sum: number, week: { count: number }) => sum + week.count, 0), state.contributions);
    assert.deepEqual(errors, []);
    reports.push({ name, width, height, times, geometryBytesIdentical: true, pixelIdentical: true, counts: personalized.counts });
    await sourcePage.close();
    await extractedPage.close();
  }
  await writeFile(new URL('parity.json', out), JSON.stringify({ status: 'passed', renderer: provenance.renderer, reports, seamlessSnowAndRotation: true }, null, 2));
  console.log('PASS: source geometry bytes + pixel-exact parity at 5 timestamps in portrait and landscape; personalized weekly lights and seamless 24-second snow/rotation.');
} finally {
  await browser.close();
}
