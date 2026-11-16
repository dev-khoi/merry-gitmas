// Mechanically extract the supplied, grid/z-buffer version of index.html.
// Keep the source bytes intact; normalize line endings only in generated code.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(process.argv[2] ?? path.join(root, '../ascii-christmas-tree/index.html'));
const original = await readFile(source);
const html = original.toString('utf8').replace(/\r\n/g, '\n');

function between(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Source extraction anchor missing: ${start}`);
  return html.slice(a, b);
}
function replace(text, before, after, expected = 1) {
  const count = text.split(before).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} extraction matches, found ${count}: ${before}`);
  return text.split(before).join(after);
}

let config = between('      const TAU = Math.PI * 2;', '      // ---------------------------------------------------------------- helpers');
config = replace(config, 'new URLSearchParams(location.search)', 'new URLSearchParams()');
config += `
      OPT.spin = options.reference ? OPT.spin : 24;
      OPT.hud = false;
      const frequency = (rate) => options.reference ? rate :
        TAU / 24 * Math.max(1, Math.round(rate * 24 / TAU));
`;

let geometry = between('      // ---------------------------------------------------------------- helpers', '      // ---------------------------------------------------------------- renderer');
geometry = replace(geometry, 'const rng = makeRng(7);', 'const rng = makeRng(options.reference ? 7 : (options.seed ?? 7));');
geometry = replace(geometry, '        // --- trunk: a cylinder with bark stripes', `        // --- trunk: a cylinder with bark stripes
        const trunkRadius = 0.085 * (options.reference ? 1 : 0.75 + 0.85 * (options.state?.fullness ?? 1));`);
geometry = replace(geometry, '0.085 * Math.cos(a)', 'trunkRadius * Math.cos(a)');
geometry = replace(geometry, '0.085 * Math.sin(a)', 'trunkRadius * Math.sin(a)');
geometry = replace(geometry, 'const rad = rng.range(0.05, 0.07) * (0.8 + 0.4 * (1 - u));',
  'const rad = rng.range(0.05, 0.07) * (0.8 + 0.4 * (1 - u)) * (options.reference ? 1 : 1.25);');
geometry = replace(geometry, '        const bow = fibSphere(400);', `        if (!options.reference && options.state) {
          const languages = options.state.languages.slice(0, 6);
          const templates = gifts.slice();
          gifts.splice(0, gifts.length, ...languages.map((language, index) => ({
            ...templates[index % templates.length],
            ang: 0.5 + index * TAU / languages.length,
            col: [1, 3, 5].map(offset => parseInt(language.color.slice(offset, offset + 2), 16) / 255),
            rib: [0.95, 0.95, 1],
          })));
        }
        const bow = fibSphere(400);`);

let setup = between('      // Camera: orbiting', '      // ---------------------------------------------------------------- overlay text');
setup = replace(setup, 'dpr = Math.min(window.devicePixelRatio || 1, 2);', 'dpr = 1;');
setup = replace(setup, 'widthPx = Math.max(64, Math.floor(window.innerWidth * dpr));', 'widthPx = Math.max(64, canvasWidth);');
setup = replace(setup, 'const viewH =\n          window.innerHeight - (codeState.open ? codePanel.offsetHeight : 0);', 'const viewH = canvasHeight;');
setup = replace(setup, '        canvas.style.height = `${viewH}px`;\n', '');
setup = replace(setup,
  'scale = Math.min((widthPx * 0.94) / 2.5, (heightPx * 0.70) / 3.35);',
  'scale = Math.min((widthPx * 0.94) / 2.5, (layoutHeight * 0.70) / 3.35) * (options.reference ? 1 : (options.state?.scale ?? 1));');
setup = replace(setup,
  'centerY = heightPx * (heightPx >= widthPx ? 0.62 : 0.54);',
  'centerY = layoutHeight * (layoutHeight >= widthPx ? 0.62 : 0.54);');
setup = replace(setup,
  'g.font = `bold ${Math.round(cellH * 0.92)}px Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", monospace`;',
  'g.font = `bold ${Math.round(cellH * 0.92)}px ${options.fontFamily ?? \'Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", monospace\'}`;');
setup = replace(setup, '        fwSprites = FW_COLORS.map((c) => makeGlow(c, scale * 0.6));\n        fwGlyphs = Array.from(FW_RAMP, getGlyph);\n', '');
setup = replace(setup, 'Math.min(3000, Math.max(380, 2 * halfW * (top - bottom) * 34))',
  'Math.min(3000, Math.max(380, 2 * halfW * (top - bottom) * 34)) * (options.reference ? 1 : 0.25)');

let overlay = between('      // ---------------------------------------------------------------- overlay text', "      // ---------------------------------------------------------------- Santa's sleigh");
overlay = replace(overlay, 'tAbs * 2.2 - cell.col * 0.22', 'tAbs * frequency(2.2) - cell.col * 0.22');
overlay = replace(overlay, 'smoothstep(0.15, 0.6, zr) * clamp01((t - gift.t0 - 1.0) / 0.5)',
  '(options.reference ? smoothstep(0.15, 0.6, zr) : smoothstep(-0.3, 0, zr)) * clamp01((t - gift.t0 - 1.0) / 0.5)');
overlay = replace(overlay, '        scene.gifts.forEach((gift, gi) => {', `        const giftAngle = options.reference ? 0 : tAbs * TAU / 24 * (giftCycles - 1);
        const giftCos = Math.cos(Math.atan2(sinT, cosT) + giftAngle);
        const giftSin = Math.sin(Math.atan2(sinT, cosT) + giftAngle);
        scene.gifts.forEach((gift, gi) => {`);
overlay = replace(overlay, 'gift.x * cosT + gift.z * sinT', 'gift.x * giftCos + gift.z * giftSin');
overlay = replace(overlay, '-gift.x * sinT + gift.z * cosT', '-gift.x * giftSin + gift.z * giftCos');
for (let channel = 0; channel < 3; channel++) {
  overlay = replace(overlay, `(0.6 + 0.4 * gift.rib[${channel}]) * facing`,
    `(options.reference ? 0.6 + 0.4 * gift.rib[${channel}] : gift.col[${channel}]) * facing`);
}
let frame = between('      function render(t, tAbs, dt)', '      function frame(now)');
frame = replace(frame, '        const invCW = 1 / cellW,', `        const giftTheta = theta * giftCycles;
        const giftCos = Math.cos(giftTheta), giftSin = Math.sin(giftTheta);
        const invCW = 1 / cellW,`);
frame = replace(frame, 'const xr = billboard ? x : x * cosT + z * sinT;',
  'const isGift = K[i] === GIFT || K[i] === RIBBON;\n          const xr = billboard ? x : isGift ? x * giftCos + z * giftSin : x * cosT + z * sinT;');
frame = replace(frame, 'const zr = billboard ? z : -x * sinT + z * cosT;',
  'const zr = billboard ? z : isGift ? -x * giftSin + z * giftCos : -x * sinT + z * cosT;');
frame = replace(frame, 'const nxr = nx * cosT + nz * sinT;',
  'const giftNormal = kind === GIFT || kind === RIBBON;\n            const nxr = giftNormal ? nx * giftCos + nz * giftSin : nx * cosT + nz * sinT;');
frame = replace(frame, 'const nzr = -nx * sinT + nz * cosT;',
  'const nzr = giftNormal ? -nx * giftSin + nz * giftCos : -nx * sinT + nz * cosT;');
frame = replace(frame,
  '            f.y[j] -= f.speed[j] * dt;\n            if (f.y[j] < f.bottom) f.y[j] += span;',
  `            if (options.reference) {
              f.y[j] -= f.speed[j] * dt;
              if (f.y[j] < f.bottom) f.y[j] += span;
            }
            // Absolute-time snow is independent of render order and traverses
            // whole vertical spans per loop, retaining the source's depth layers.
            const snowY = options.reference ? f.y[j] : f.bottom +
              (((f.y[j] - f.bottom - span * (tAbs / 24) * (f.z[j] > 1.8 ? 2 : 1)) % span + span) % span);`);
frame = replace(frame, 'centerY - f.y[j] * w', 'centerY - snowY * w');
frame = replace(frame, 'tAbs * 0.65 + f.phase[j]', 'tAbs * frequency(0.65) + f.phase[j]');
frame = replace(frame, 'tAbs * 1.3 + f.phase[j] * 2', 'tAbs * frequency(1.3) + f.phase[j] * 2');
frame = replace(frame,
  '0.55 + 0.45 * Math.sin(tAbs * (1.5 + SH[i] * 2.5) + PH[i])',
  '(weeklyLights.has(i) ? (weeklyLights.get(i).count > 0 ? 0.78 + (options.state?.twinkle ?? 0) * 0.22 * Math.sin(tAbs * frequency(2) + PH[i]) : 0.45) : 0.55 + 0.45 * Math.sin(tAbs * frequency(1.5 + SH[i] * 2.5) + PH[i]))', 2);
frame = replace(frame, 'tAbs * 5 + PH[i]', 'tAbs * frequency(5) + PH[i]');
frame = replace(frame, 'tAbs * 2.3 + PH[i] * 7', 'tAbs * frequency(2.3) + PH[i] * 7');
frame = replace(frame, 'Math.sin(tAbs * 3)', 'Math.sin(tAbs * frequency(3))');
frame = replace(frame, 'Math.sin(tAbs * 2.1)', 'Math.sin(tAbs * frequency(2.1))');
frame = replace(frame, 'const li = (0.35 + 0.75 * diff) * depth;',
  'const li = (options.reference ? 0.35 + 0.75 * diff : 0.45 + 0.65 * diff) * depth;');
frame = replace(frame, 'tAbs * 2.4 + k * 1.7', 'tAbs * frequency(2.4) + k * 1.7');
frame = replace(frame,
  `        // 3b. Fireworks behind the optional greeting and Santa's passing team.
        letters += drawFireworks(tAbs);
        letters += drawOverlay(t, tAbs, cosT, sinT);
        letters += drawSanta(t, tAbs);`,
  '        // Gift labels and optional source text use the original glyph grid.\n        letters += drawOverlay(t, tAbs, cosT, sinT);');
frame = replace(frame,
  `        drawFireworkGlow();
        if (santaNose) {
          ctx.globalAlpha = 0.75 + 0.15 * Math.sin(tAbs * 4);
          const noseGlow = glowSprites[2];
          ctx.drawImage(noseGlow, santaNose.x - noseGlow.width / 2, santaNose.y - noseGlow.height / 2);
        }
`, '');
// Thin the original point cloud only in personalized mode; reference mode keeps
// every point and its original order for an exact source comparison.
frame = replace(frame, 'if (t < T[i]) {', `if (t < T[i] || (!options.reference && (K[i] === NEEDLE || K[i] === SNOWCAP) &&
            ((Math.imul(i + 1, 2654435761) >>> 0) / 4294967296 >= Math.pow(options.state?.fullness ?? 1, 2) ||
             Math.hypot(P[i3], P[i3 + 2]) > envelope(P[i3 + 1]) * (0.4 + 0.7 * (options.state?.fullness ?? 1))))) {`);
frame = replace(frame, 'const pulse = 0.85 + 0.15 * Math.sin(tAbs * frequency(2.1));', `const activity = options.reference ? 0 : (options.state?.twinkle ?? 0);
          const pulse = options.reference ? 0.85 + 0.15 * Math.sin(tAbs * frequency(2.1)) :
            0.9 - 0.45 * activity + (0.1 + 0.45 * activity) * Math.pow(0.5 + 0.5 * Math.sin(tAbs * frequency(2.1)), 2);
          const aura = 1 + activity * (1.4 + 1.8 * pulse);`);
frame = replace(frame, `            sx - starSprite.width / 2,
            sy - starSprite.height / 2,`, `            sx - starSprite.width * aura / 2,
            sy - starSprite.height * aura / 2,
            starSprite.width * aura,
            starSprite.height * aura,`);

const personalize = `
      const scene = buildScene();
      // Whole revolutions preserve the seamless 24-second export loop.
      const giftCycles = options.reference ? 1 : Math.max(1, Math.ceil(6 / Math.max(1, scene.gifts.length)));
      const weeklyLights = new Map();
      if (!options.reference && options.state) {
        const state = options.state;
        const languages = state.languages.slice(0, 6);
        const languageShare = languages.reduce((sum, language) => sum + language.share, 0);
        const color = (hex) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
        const languageFor = (index) => {
          const target = ((index * 0.61803398875) % 1) * languageShare;
          let total = 0;
          return languages.find(language => { total += language.share; return target < total; }) ?? languages.at(-1);
        };
        // Recolor every surface point of a bauble together, preserving its
        // sphere geometry, normals, original shading, and specular highlights.
        for (let i = 0; i < scene.count; i++) {
          if (scene.K[i] !== BALL || !state.languages.length) continue;
          const rgb = color(languageFor(scene.O[i] - 10).color);
          scene.C.set(rgb, i * 3);
        }
        const sourceLights = scene.lights;
        for (const light of sourceLights) scene.T[light.index] = Infinity;
        scene.lights = state.weeks.map((week, index) => {
          const light = sourceLights[Math.floor((index + 0.5) / state.weeks.length * sourceLights.length)];
          const hex = week.longest ? '#ffd76a' : week.count > 0 ? '#b9f4da' : '#46546b';
          const rgb = color(hex);
          const paletteIndex = LIGHT_COLORS.length;
          LIGHT_COLORS.push(rgb);
          scene.C.set(rgb, light.index * 3);
          scene.T[light.index] = T_LIGHTS;
          weeklyLights.set(light.index, week);
          return { index: light.index, color: paletteIndex };
        });
        CONFIG.gifts = state.languages.slice(0, 6).map(language => language.name);
      }
`;

const result = `// GENERATED by scripts/extract-tree.mjs from vendor/original.html.
// The source grid, z-buffer, ImageData glyph rasterizer, snow, and glows are retained.
export function createTreeRenderer(canvas, options = {}) {
      const canvasWidth = canvas.width, canvasHeight = canvas.height;
      const layoutHeight = Math.max(64, canvasHeight - (options.reference ? 0 : (options.bottomPadding ?? 0)));
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!ctx) throw new Error('A 2D canvas context is required');
${config}
${geometry}
${personalize}
${setup}
${overlay}
      const hudState = { letters: 0, lights: 0, fps: 0 };
${frame}
      resize();
      return {
        draw(seconds, buildProgress = 1, dt = 0) {
          if (!Number.isFinite(seconds) || !Number.isFinite(buildProgress) || !Number.isFinite(dt) || dt < 0) throw new Error('Invalid frame timing');
          const elapsed = options.reference ? seconds : ((seconds % 24) + 24) % 24;
          const buildTime = options.reference ? seconds : 30 * clamp01(buildProgress);
          render(buildTime, elapsed, dt);
        },
        counts: {
          points: scene.count,
          needles: scene.K.filter(k => k === NEEDLE).length,
          snowcaps: scene.K.filter(k => k === SNOWCAP).length,
          ornaments: new Set(scene.O.filter((_, i) => scene.K[i] === BALL)).size,
          garland: scene.K.filter(k => k === GARLAND).length,
          lights: scene.lights.length,
          gifts: scene.gifts.length,
          flakes: flakes.count,
        },
        geometry: { positions: scene.P, normals: scene.N, colors: scene.C, kinds: scene.K,
          reveal: scene.T, phases: scene.PH, shading: scene.SH, objects: scene.O },
        weekLights: Array.from(weeklyLights, ([index, week]) => ({ index, ...week })),
      };
}
`;
await mkdir(path.join(root, 'vendor'), { recursive: true });
await writeFile(path.join(root, 'vendor/original.html'), original);
await writeFile(path.join(root, 'vendor/tree.js'), result);
await writeFile(path.join(root, 'vendor/source.json'), JSON.stringify({
  repository: 'https://github.com/NawaMayumi/ascii-christmas-tree',
  file: 'index.html',
  renderer: 'character-grid-z-buffer',
  customized: true,
  sha256: createHash('sha256').update(original).digest('hex'),
}, null, 2) + '\n');
console.log('Extracted the updated character-grid tree, snowfall, gifts, and glows into vendor/tree.js.');
