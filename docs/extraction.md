# Renderer extraction

This page explains how the bundled tree renderer is generated. For normal setup and usage, start with the [README](../README.md). For appearance controls, see [development and customization](development.md).

## Source files

- `vendor/original.html` is the saved, customized source scene.
- `vendor/source.json` records its provenance and SHA-256 hash.
- `scripts/extract-tree.mjs` extracts the renderer and applies the GitHub-specific adaptations.
- `vendor/tree.js` is the generated renderer, checked into Git.

The source scene uses a character grid, a per-cell depth buffer, and a shaded 3D point cloud. The extraction retains the branches, trunk, ornaments, tinsel, gifts, snowfall, and light effects. It removes the source editor, page controls, fireworks, and Santa/reindeer effects.

The saved source has no license file; no blanket license is asserted over its artwork.

## Regenerate the renderer

Use the saved source so the result does not depend on another checkout:

```sh
node scripts/extract-tree.mjs vendor/original.html
npm run build
```

If you deliberately want to import changes from the sibling `ascii-christmas-tree/index.html`, run `npm run extract` instead. This also updates the saved source and hash.

The extraction checks each replacement anchor and fails if the source no longer matches. Keep the search string equal to the source text; change the replacement string to customize the result. Editing `vendor/tree.js` directly is temporary: the next extraction overwrites it.

## Personalized rendering

- Account identity provides a stable seed for the scene.
- Contribution totals control overall scale, needle filtering, branch reach, and trunk radius. The current renderer adjusts existing geometry rather than generating extra branches.
- Weekly activity selects one spiral light for each calendar week. Active weeks are mint, the longest streak is gold, and inactive or upcoming weeks are dim.
- Up to six languages determine ornament colors and matching gifts and labels. Fewer gifts complete more revolutions during the same loop.
- Recent activity strengthens the star aura. Its size is capped at 1.7× the base glow sprite.
- Snowfall uses one quarter of the source flake count. Rotation, snowfall, and pulsing effects loop over 24 seconds and can be rendered in any frame order.
- Exports use bundled regular and bold JetBrains Mono fonts.
- GIF and PNG exports use transparent canvases. GIF encoding dithers alpha and clears each frame to prevent trails. Light-mode variants use deeper glyph colors, subdued glow, and lighter ground coverage. The HTML preview follows the browser's color scheme.

The growth formulas live in `src/tree-state.ts`; framing and captions live in `src/scene.ts`.

## Reference mode

The renderer's `reference: true` option retains the original geometry, seed, fonts, timing, and opaque background. It supports manual source-parity checks with `npm run test:visual`, which writes comparison images to `test-output/`.

The default GitHub workflow builds and generates artwork. It does not run the optional visual and export-check scripts, which may need updated expectations after appearance changes.
