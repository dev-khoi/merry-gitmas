import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createDemoSnapshot } from '../src/snapshot.js';
import { deriveTreeState } from '../src/tree-state.js';

const root = new URL('../', import.meta.url);
const out = new URL('../test-output/', import.meta.url);
await mkdir(out, { recursive: true });
const bundle = await readFile(new URL('dist/scene.js', root), 'utf8');
const font = (await readFile(new URL('dist/jetbrains-mono.woff2', root))).toString('base64');
const boldFont = (await readFile(new URL('dist/jetbrains-mono-bold.woff2', root))).toString('base64');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 380, height: 544 } });
  await page.setContent(`<style>body{margin:0}@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(data:font/woff2;base64,${font})}@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(data:font/woff2;base64,${boldFont})}</style><canvas width="380" height="544"></canvas>`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(async () => {
    await document.fonts.load('12px "JetBrains Mono"');
    await document.fonts.load('bold 12px "JetBrains Mono"');
    await document.fonts.ready;
  });
  const snapshot = createDemoSnapshot();
  const greenPixels: number[] = [];
  for (const [name, daily] of [['sparse', 0], ['medium', 3], ['full', 20]] as const) {
    const variant = structuredClone(snapshot);
    variant.days.forEach(day => { day.count = daily; });
    const state = deriveTreeState(variant);
    const count = await page.evaluate(state => {
      const canvas = document.querySelector('canvas')!;
      (window as any).MerryGitmas.mount(canvas, state).draw(0);
      const rgba = canvas.getContext('2d')!.getImageData(0, 100, 380, 230).data;
      let green = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 1] > 25 && rgba[i + 1] > rgba[i] * 1.3 && rgba[i + 1] > rgba[i + 2] * 1.15) green++;
      }
      return green;
    }, state);
    greenPixels.push(count);
    await page.locator('canvas').screenshot({ path: fileURLToPath(new URL(`appearance-${name}.png`, out)) });
  }
  assert.ok(greenPixels[2] > greenPixels[0] * 2, `Full trees must have visibly more foliage: ${greenPixels}`);
  assert.ok(greenPixels[1] > greenPixels[0] && greenPixels[2] > greenPixels[1]);

  const base = deriveTreeState(snapshot);
  const aura: number[] = [];
  for (const activity of [0, 1]) {
    aura.push(await page.evaluate(state => {
      const canvas = document.querySelector('canvas')!;
      (window as any).MerryGitmas.mount(canvas, state).draw(1.5);
      const rgba = canvas.getContext('2d')!.getImageData(100, 0, 180, 100).data;
      let light = 0;
      for (let i = 0; i < rgba.length; i += 4) light += rgba[i] + rgba[i + 1];
      return light;
    }, { ...base, twinkle: activity }));
  }
  assert.ok(aura[1] > aura[0] * 1.2, `Recent activity must visibly strengthen the star aura: ${aura}`);

  for (const count of [0, 1, 2, 6, 8]) {
    const languages = Array.from({ length: count }, (_, index) => ({ name: `Language ${index + 1}`, color: index % 2 ? '#f1e05a' : '#3178c6', share: 1 / count }));
    const result = await page.evaluate(state => {
      const canvas = document.querySelector('canvas')!;
      const renderer = (window as any).MerryGitmas.createTreeRenderer(canvas, { seed: state.seed, state });
      const images = [0, 8, 24, 0].map(time => { renderer.draw(time); return canvas.toDataURL(); });
      return { gifts: renderer.counts.gifts, images };
    }, { ...base, languages });
    assert.equal(result.gifts, Math.min(6, count));
    assert.equal(result.images[0], result.images[2], 'Every gift count must loop seamlessly');
    assert.equal(result.images[0], result.images[3], 'Gift rendering must be deterministic');
  }
  console.log(`PASS: increasing foliage coverage ${greenPixels}; stronger recent-activity star aura ${aura}; 0/1/2/6/8 languages and seamless loops.`);
} finally {
  await browser.close();
}
