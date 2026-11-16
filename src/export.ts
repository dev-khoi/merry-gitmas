import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import gifenc from 'gifenc';
import { deriveTreeState, type TreeState } from './tree-state.js';
import { validateSnapshot, type Snapshot } from './snapshot.js';
import { createPreview } from './preview.js';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const root = fileURLToPath(new URL('../', import.meta.url));

export interface ExportOptions {
  outputDir: string;
  width: number;
  height: number;
  fps: number;
  still: boolean;
}

export async function exportTree(input: Snapshot, options: ExportOptions): Promise<void> {
  const snapshot = validateSnapshot(input);
  const state = deriveTreeState(snapshot);
  const { width, height, fps } = options;
  if (!Number.isInteger(width) || width < 240 || width > 1080 || !Number.isInteger(height) || height < 300 || height > 1200) {
    throw new Error('Dimensions must be integers: width 240–1080, height 300–1200.');
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 30) throw new Error('FPS must be an integer between 1 and 30.');
  const [bundle, font, boldFont, fontLicense] = await Promise.all([
    readFile(path.join(root, 'dist/scene.js'), 'utf8'),
    readFile(path.join(root, 'dist/jetbrains-mono.woff2')),
    readFile(path.join(root, 'dist/jetbrains-mono-bold.woff2')),
    readFile(path.join(root, 'dist/FONT-LICENSE.txt'), 'utf8'),
  ]).catch(() => { throw new Error('Renderer assets are missing. Run npm run build first.'); });
  const preview = createPreview(state, bundle, font.toString('base64'), boldFont.toString('base64'), width, height, fontLicense);
  const out = path.resolve(options.outputDir);
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true }).catch(() => {
    throw new Error('Chromium could not start. Install it with npx playwright install chromium (on Linux CI: npx playwright install --with-deps chromium).');
  });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    // Export only the renderer. No live preview animation, requests, or clock.
    await page.setContent(`<style>@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(data:font/woff2;base64,${font.toString('base64')})}@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(data:font/woff2;base64,${boldFont.toString('base64')})}body{margin:0}</style><canvas width="${width}" height="${height}"></canvas>`);
    await page.addScriptTag({ content: bundle });
    await page.evaluate(async state => {
      await document.fonts.load('12px "JetBrains Mono"');
      await document.fonts.load('bold 12px "JetBrains Mono"');
      await document.fonts.ready;
      const win = window as unknown as { MerryGitmas: { mount(canvas: HTMLCanvasElement, state: TreeState, options?: { transparent?: boolean }): { draw(time: number): void } }; scene: { draw(time: number): void } };
      win.scene = win.MerryGitmas.mount(document.querySelector('canvas')!, state, { transparent: true });
      win.scene.draw(0);
    }, state);
    await page.locator('canvas').screenshot({ path: path.join(out, 'tree.png'), omitBackground: true });
    if (!options.still) {
      const gif = GIFEncoder();
      const frames = 24 * fps;
      let palette: number[][] | undefined;
      // Fixed ordered alpha dithering preserves soft glows with GIF's 1-bit alpha.
      const alphaThresholds = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let frame = 0; frame < frames; frame++) {
        const encoded = await page.evaluate(time => {
          (window as unknown as { scene: { draw(time: number): void } }).scene.draw(time);
          const canvas = document.querySelector('canvas')!;
          const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
          let binary = '';
          for (let i = 0; i < rgba.length; i += 32768) binary += String.fromCharCode(...rgba.subarray(i, i + 32768));
          return btoa(binary);
        }, frame / fps);
        const rgba = new Uint8Array(Buffer.from(encoded, 'base64'));
        palette ??= quantize(rgba, 127, { format: 'rgb444' });
        const indexed = applyPalette(rgba, palette, 'rgb444');
        // Index zero is both the logical background and every frame's transparent color.
        for (let i = 0; i < indexed.length; i++) {
          const x = i % width;
          const y = Math.floor(i / width);
          const threshold = (alphaThresholds[(y % 4) * 4 + x % 4] + 0.5) * 16;
          indexed[i] = rgba[i * 4 + 3] > threshold ? indexed[i] + 1 : 0;
        }
        // GIF time uses centiseconds: distribute rounding, preserving 24s total.
        const delay = (Math.round((frame + 1) * 100 / fps) - Math.round(frame * 100 / fps)) * 10;
        // Clear complete frames between draws so moving objects never leave trails.
        gif.writeFrame(indexed, width, height, {
          palette: frame === 0 ? [[0, 0, 0], ...palette] : undefined,
          delay, repeat: 0, transparent: true, transparentIndex: 0, dispose: 2,
        });
        if (frame % fps === 0) process.stdout.write(`\rRendering ${Math.floor(frame / fps) + 1}/24 seconds…`);
      }
      gif.finish();
      await writeFile(path.join(out, 'tree.gif'), gif.bytes());
      process.stdout.write('\n');
    }
    await Promise.all([
      writeFile(path.join(out, 'preview.html'), preview),
      writeFile(path.join(out, 'snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n'),
      writeFile(path.join(out, 'tree-state.json'), JSON.stringify(state, null, 2) + '\n'),
      writeFile(path.join(out, 'FONT-LICENSE.txt'), fontLicense),
    ]);
  } finally {
    await browser.close();
  }
  console.log(`Tree ready: ${out}\n${state.contributions} contributions · ${state.activeWeeks} active weeks · ${state.longestStreak}-week longest streak`);
}
