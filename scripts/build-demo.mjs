import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
let renderer = await read('vendor/tree.js');
// Adapt only the demo's choreography. Keep the action's renderer and export
// timings unchanged. Fail loudly if a future renderer extraction moves an anchor.
function replace(before, after) {
  if (!renderer.includes(before)) throw new Error(`Demo renderer anchor missing: ${before}`);
  renderer = renderer.replace(before, after);
}
replace('export function createTreeRenderer', 'function createTreeRenderer');
replace('const T_GARLAND = 6.2,', 'const T_GARLAND = options.choreography.garland.at,');
replace('T_BALLS = 7.6,', 'T_BALLS = options.choreography.ornaments.at,');
replace('T_LIGHTS = 8.6,', 'T_LIGHTS = options.choreography.illuminate.at,');
replace('T_STAR = 9.7,', 'T_STAR = options.choreography.star.at,');
replace('T_GIFTS = 10.5,', 'T_GIFTS = options.choreography.gifts[0].at,');
replace('1.3 + 5.0 * f + 0.45 * s', 'options.choreography.tree.at + options.choreography.tree.duration * (6.2 * f + 0.45 * s) / 6.65');
replace('T_GARLAND + 2.2 * u', 'T_GARLAND + options.choreography.garland.duration * u');
replace('T_BALLS + rng.u() * 1.4', 'T_BALLS + rng.u() * options.choreography.ornaments.duration');
replace('T_GIFTS + gi * 0.45', 'options.choreography.gifts[gi].at');
replace('clamp01(t / 1.2)', 'clamp01((t - options.choreography.ground.at) / options.choreography.ground.duration)');
replace('clamp01((t - T_STAR) / 0.6)', 'clamp01((t - T_LIGHTS) / options.choreography.illuminate.duration)');
replace('clamp01((t - T_LIGHTS) / 1.5)', 'clamp01((t - T_LIGHTS) / options.choreography.illuminate.duration)');
replace('scene.T[light.index] = T_LIGHTS;', 'scene.T[light.index] = T_LIGHTS + index / state.weeks.length * options.choreography.illuminate.duration;');
replace('const theta = (tAbs * TAU) / OPT.spin;', 'const theta = Math.max(0, tAbs - options.choreography.spin.at) * TAU / options.choreography.spin.period;');
replace('tAbs * TAU / 24 * (giftCycles - 1)', 'Math.max(0, tAbs - options.choreography.spin.at) * TAU / options.choreography.spin.period * (giftCycles - 1)');
replace('const elapsed = options.reference ? seconds : ((seconds % 24) + 24) % 24;', 'const elapsed = seconds;');
replace('layoutHeight * 0.70', 'layoutHeight * 0.78');
replace('layoutHeight >= widthPx ? 0.62 : 0.54', '0.48');
replace('(options.reference ? 1 : 0.25)', '(options.reference ? 1 : 1.5)');

const font = await readFile(new URL('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', root));
const license = await read('node_modules/@fontsource/jetbrains-mono/LICENSE');
const script = `${renderer}\n${await read('demo/player.js')}`.replace(/<\/script/gi, '<\\/script');
const html = (await read('demo/template.html'))
  .replace('/* DEMO_FONT */', `@font-face{font-family:JetBrains;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900;font-display:swap}`)
  .replace('/* DEMO_SCRIPT */', script)
  .replace('<!-- FONT_LICENSE -->', `<script type="text/plain" id="font-license">${license.replace(/<\/script/gi, '<\\/script')}</script>`);
await writeFile(new URL('demo/index.html', root), html);
console.log('Built demo/index.html — standalone, offline, no server required.');
