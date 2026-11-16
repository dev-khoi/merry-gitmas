# Faithful extraction of the updated ASCII scene

## Source and provenance

The source of truth is the **current local `ascii-christmas-tree/index.html`**, including the replacement content and subsequent snowfall/effect edits supplied for this project. This is the character-grid/z-buffer version, not the earlier canvas `fillText` point-cloud renderer. The checkout originally came from [`NawaMayumi/ascii-christmas-tree`](https://github.com/NawaMayumi/ascii-christmas-tree); the recorded HTML is a customized local snapshot, not a claim about the current upstream file.

`vendor/original.html` is a **byte-for-byte copy** of that supplied file. `vendor/source.json` records its SHA-256, renderer type, and customized status. Extraction does not edit the source checkout. The supplied checkout has no license file; no blanket license is asserted over the artwork.

`scripts/extract-tree.mjs` creates `vendor/tree.js` mechanically. Missing anchors, missing replacements, and unexpected replacement counts fail extraction. The generated renderer is checked in, so users and CI do not need the sibling source repository.

Regenerate from the current source checkout:

```sh
npm run extract
```

Or regenerate from the recorded snapshot:

```sh
npm run extract -- vendor/original.html
```

Then run `npm run build` and `npm run test:visual`.

## What is retained

The extraction keeps these original sections and algorithms:

1. Options, configuration, `makeRng`, helpers, character ramps, lighting colors, and timeline constants.
2. `buildScene`: 24 tiers of drooping branch tufts, snowcaps, a cylindrical trunk, dense gold tinsel, 26 shaded spherical ornaments, 170 original fairy lights, the five-pointed star, and five ribboned gifts.
3. Camera projection, per-cell z-buffer, per-object sub-cell silhouette coverage, cached sparse glyph rasterization, `ImageData` pixel blitting, ground ray-casting, and the denser layered snowfall.
4. The original gift-tag/text drawing helpers.
5. `render`: point projection, visibility, lighting, surface shading, specular ball highlights, tinsel shimmer, light glows, star glow, and dashed star rays.

The tree is not approximated using a cone, CSS, or replacement geometry. All eight geometry typed arrays (`P`, `N`, `C`, `K`, `T`, `PH`, `SH`, `O`) retain identical bytes in reference mode.

The source's editor, code typing, fullscreen control, HUD, page lifecycle, animation scheduling, and DOM resize listeners are not imported. Santa/reindeer and fireworks implementations are deliberately excluded from the generated renderer; the source snapshot has both effects disabled and contains no countdown.

## Intentional adaptations

### Hosting and time

- The renderer receives a canvas rather than querying the page. Canvas dimensions replace window dimensions; rendering uses device scale 1 for reproducible exports.
- `draw(seconds, buildProgress = 1, dt = 0)` receives explicit time. It schedules no animation and reads no clock.
- Reference mode uses the source seed 7, its 20-second spin, native font stack, original decorations and tag labels, original frequencies, and its original snow update using explicit `dt`. Build time equals `seconds`, allowing exact checks of the source reveal sequence.
- Personalized mode renders the fully built scene by default. An optional build-progress argument maps 0–1 to 0–30 seconds of the source's timeline, covering branches, ornaments, lights, star, and gifts.

### GitHub personalization

- Account identity seeds the original geometry builder.
- Contributions control scene scale and a deterministic thinning mask over original needles/snowcaps. The mask is bypassed in reference mode.
- Each bauble's surface points receive a language color together. Its original sphere geometry, surface normals, shading, and specular highlights remain intact.
- The source light spiral supplies one existing bulb for each Monday-based week touching the selected year (53, occasionally 54). Unselected source bulbs are hidden. The selected bulbs use mint for active weeks, gold for the earliest longest streak, and dim blue-gray for quiet/upcoming weeks.
- Gift labels use up to five language names instead of the source's personal family-name defaults.

### Deterministic animation and fonts

- Personalized rotation, snow, wind, light twinkle, tinsel shimmer, and star pulsation complete whole cycles in 24 seconds.
- Personalized snow positions are calculated from absolute time, rather than accumulating `dt`. Flakes traverse whole vertical spans per loop; front and back layers retain the source's depth differences. Rendering out of order or scrubbing produces the same frame.
- Exports and the offline preview use bundled regular and bold JetBrains Mono fonts. Both faces load before the one-time glyph rasterization. Reference comparisons use the original native font stack on both sides and do not replace the source's glyphs.

## How fidelity is verified

`npm run test:visual` runs **the actual supplied HTML program** beside the extracted renderer in Chromium. It only disables automatic frame scheduling and exposes the source's existing `render` function and arrays after initialization. It does not rewrite source geometry, shading, fonts, or snow behavior.

For 420 × 457 portrait and 960 × 640 landscape canvases, it verifies:

- The recorded source bytes match their SHA-256.
- Every byte of every geometry typed array matches the source.
- Every RGBA pixel matches at 0, 3.5, 7, 12, and 19 seconds, including partial growth, lighting, gifts, and snowfall advanced using matching explicit time steps.
- Personalized frames at 0 and 24 seconds are identical, including snowfall and glows.
- Rendering out of order produces the same frame, while different times animate the scene.
- There are 26 baubles, five gifts, dense snowfall, and exactly one unique selected bulb per weekly bucket.
- Weekly-light counts sum to the snapshot contribution total.
- The browser bundle contains no Santa/reindeer or firework drawing routines.

Comparison PNGs and `parity.json` are written to `test-output/`. `npm run test:exports` additionally decodes the generated GIF and compares composited frames with the live renderer, checks GIF duration and dimensions, and exercises the offline desktop/mobile preview, playback controls, scrubbing, and reduced-motion mode.
