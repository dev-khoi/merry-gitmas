import type { TreeState } from './tree-state.js';

export function createPreview(state: TreeState, bundle: string, fontBase64: string, boldFontBase64: string, width: number, height: number, fontLicense: string): string {
  const serialized = JSON.stringify(state).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark"><title>Merry Gitmas · ${state.login}</title>
<style>
@font-face { font-family: 'JetBrains Mono'; src: url(data:font/woff2;base64,${fontBase64}) format('woff2'); font-weight: 400; font-display: block; }
@font-face { font-family: 'JetBrains Mono'; src: url(data:font/woff2;base64,${boldFontBase64}) format('woff2'); font-weight: 700; font-display: block; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #05060a; color: #c9d1d9; font: 12px/1.7 'JetBrains Mono', monospace; display: grid; place-items: center; padding: 28px 16px; }
main { width: min(100%, ${width}px); }
h1 { font-size: 12px; font-weight: 400; text-align: center; letter-spacing: .2em; color: #e0b34d; margin: 0 0 18px; }
canvas { display: block; width: 100%; height: auto; background: #060b18; border-radius: 12px; box-shadow: 0 0 0 1px #ffffff10, 0 20px 70px #0008; }
.controls { display: flex; gap: 12px; align-items: center; margin: 16px 0; }
button { background: #121c2c; border: 1px solid #35415a; color: #e6edf3; font: inherit; padding: 6px 12px; border-radius: 6px; cursor: pointer; min-width: 78px; }
button:focus-visible, input:focus-visible { outline: 2px solid #e0b34d; outline-offset: 3px; }
input { min-width: 0; width: 100%; accent-color: #e0b34d; }
p { color: #8a97ab; margin: 8px 0; font-size: 10px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; }
.language::before { content: '● '; color: var(--color); }
a { color: #a3c6e8; }
@media (prefers-reduced-motion: reduce) { canvas { box-shadow: 0 0 0 1px #ffffff10; } }
</style></head><body><main>
<h1>MERRY GITMAS</h1>
<canvas id="tree" width="${width}" height="${height}" role="img" aria-label="${state.login}'s ${state.year} ASCII Christmas tree: ${state.contributions} contributions, ${state.activeWeeks} active weeks"></canvas>
<div class="controls"><button id="pause" type="button" aria-pressed="false">Pause</button><input id="time" type="range" min="0" max="24" step="0.01" value="0" aria-label="Tree rotation time"></div>
<p id="summary"></p><p class="legend" id="legend"></p>
<p>Each spiral light is one Monday-based calendar week (${state.weeks.length} this year). Mint = active; gold = longest streak; dim = quiet or upcoming. Lower lights come first. Gift labels show your languages.</p>
<p>Ornament colors show primary-language shares of current public, non-fork owned repositories. Activity is measured through ${state.observedOn} UTC.${state.demo ? ' This is illustrative demo data.' : ' Contribution counts reflect what GitHub exposes to the collecting token.'}</p>
</main><script type="text/plain" id="font-license">${fontLicense.replace(/<\/script/gi, '<\\/script')}</script>
<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>
<script>
const state = ${serialized};
const canvas = document.getElementById('tree');
const pause = document.getElementById('pause');
const slider = document.getElementById('time');
document.getElementById('summary').textContent = state.longestStreak + '-week longest streak · ' + state.weeks.length + ' calendar-week lights';
for (const language of state.languages) {
  const item = document.createElement('span'); item.className = 'language';
  item.style.setProperty('--color', language.color);
  item.textContent = language.name + ' ' + Math.round(language.share * 100) + '%';
  document.getElementById('legend').append(item);
}
Promise.all([document.fonts.load('12px "JetBrains Mono"'), document.fonts.load('bold 12px "JetBrains Mono"')]).then(() => document.fonts.ready).then(() => {
  const scene = MerryGitmas.mount(canvas, state);
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seconds = 0, previous;
  function updateButton() { pause.textContent = playing ? 'Pause' : 'Play'; pause.setAttribute('aria-pressed', String(!playing)); }
  updateButton();
  pause.addEventListener('click', () => { playing = !playing; previous = undefined; updateButton(); });
  slider.addEventListener('input', () => { seconds = Number(slider.value); playing = false; previous = undefined; updateButton(); scene.draw(seconds); });
  function tick(now) {
    if (playing && previous !== undefined) seconds = (seconds + (now - previous) / 1000) % 24;
    previous = now; scene.draw(seconds); slider.value = String(seconds);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});
</script></body></html>`;
}
