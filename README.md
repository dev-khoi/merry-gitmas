# Merry Gitmas

**Your GitHub year, wrapped in lights.** A slowly rotating ASCII Christmas tree that grows from contributions, wears language-colored ornaments, and traces your active weeks with a spiral of lights.

The tree is mechanically extracted from the **current, locally customized `ascii-christmas-tree/index.html`** supplied for this project. It uses that file's character grid, per-cell depth buffer, shaded point-cloud branches, spherical ornaments, gifts, falling snow, and additive light/star glows. The countdown, fireworks, and Santa/reindeer effects are absent from the generated scene.

## Try it locally

Requires Node.js 22 or later.

```sh
npm ci
npx playwright install chromium
npm run build
npm run demo
```

Open `output/preview.html` in your browser. It is self-contained, works offline, and includes play/pause, rotation scrubbing, a language legend, and reduced-motion support.

The demo uses explicitly labeled illustrative data for `octocat`, through November 14, 2026. It does not fetch that account's actual activity.

### Generate your own tree

Authenticate using `gh auth login`, or supply `GH_TOKEN` / `GITHUB_TOKEN` in your environment. Then:

```sh
node dist/cli.js generate YOUR_USERNAME
node dist/cli.js generate YOUR_USERNAME --year 2025 --output-dir output/2025
```

The default is the current UTC calendar year, through **yesterday**, so a nightly refresh only includes completed days. Past years include January 1 through December 31. January 1 has no completed day in the current year; select the previous year on that date.

### Separate collection and rendering

```sh
node dist/cli.js collect YOUR_USERNAME --output-dir output/data
node dist/cli.js render output/data/snapshot.json --output-dir output/tree
```

Rendering a saved snapshot requires no GitHub token or network connection. Missing days and API errors fail collection rather than producing a misleading empty tree.

### Export controls

```sh
node dist/cli.js demo --still
node dist/cli.js demo --fps 15 --width 480 --height 580
node dist/cli.js --help
```

Defaults: 420 × 600 pixels, 10 fps, a seamless 24-second rotation **including the falling snow**. The framing includes extra space below the gifts for their language labels. Higher dimensions and frame rates increase GIF size and rendering time. `--still` skips GIF generation and writes PNG, preview, and data files; it does not remove a GIF left by an earlier render in the same folder.

## What your activity changes

| Data | Appearance |
| --- | --- |
| Selected year's contributions | Tree scale, branch reach, and strongly varying needle fullness; fully grown at 5,000 contributions |
| Top six primary languages of current public, non-fork owned repositories | Larger, brighter ornament colors, weighted by repository count within the selected languages |
| Up to six languages | One matching colored gift and label per language; fewer gifts orbit faster (two gifts make three revolutions per 24 seconds) |
| Each Monday-based week touching the year | One spiral light, chronological from bottom to top |
| Active weeks | Mint lights |
| Earliest longest run of active weeks | Gold lights |
| Last seven observed days | Stronger, more expansive pulsing star aura and weekly-light twinkle; maximum activity effect at 100 contributions |
| Stable account identity | Repeatable original-style branch and ornament arrangement |

Calendar years touch **53 weeks, occasionally 54**, rather than exactly 52. Counts only include days inside the selected year. Quiet and future weeks stay dim. The star is always present, and zero-activity accounts still get a healthy little tree.

Contributions are **GitHub-visible calendar counts**, not a commits-only metric. Depending on the collecting token and profile settings, they can include opted-in private aggregate counts or contributions visible to that token. Repository language information is explicitly public-only. Language shares describe the current repository collection, even when rendering a previous contribution year; they are not historical coding-time measurements.

## Generated files

| File | Purpose |
| --- | --- |
| `tree.gif` | Looping README artwork |
| `tree.png` | Static alternative |
| `preview.html` | Offline interactive canvas preview with embedded renderer and font |
| `snapshot.json` | Collected inputs, reusable for rendering |
| `tree-state.json` | Derived metrics and weekly-light mapping |
| `FONT-LICENSE.txt` | Bundled font's SIL Open Font License |

## Put it on your profile

Publish this folder as your Merry Gitmas repository, then copy [`examples/profile-workflow.yml`](examples/profile-workflow.yml) to `.github/workflows/gitmas.yml` in your profile repository. Replace `YOUR_USERNAME/merry-gitmas@main` with your real published repository and ref. You can pin a release tag or commit once available.

The example runs nightly, uses the built-in GitHub token, generates the image, and commits the outputs. The reusable Action itself only generates files; the example workflow handles publication. The Action targets Ubuntu runners and installs Chromium's Linux dependencies.

Add to your profile README, replacing the username and branch as appropriate:

```md
[![My Merry Gitmas tree](https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_USERNAME/main/gitmas/tree.gif)](https://github.com/YOUR_USERNAME/merry-gitmas)
```

Use `tree.png` instead for a still image. GitHub READMEs show the generated image; the interactive HTML preview can be opened locally or hosted on a static site.

Action inputs: `login` (repository owner), `year` (current UTC year), `output-dir` (`gitmas`), `token` (built-in token), and `fps` (`10`). Outputs: `gif`, `png`, and `preview` paths.

## Development and extraction checks

```sh
npm run check
npm test
npm run build
npm run test:visual
npx tsx tests/appearance.ts
npm run demo
npm run test:exports
```

The visual check compares every geometry typed-array byte and every pixel against the supplied HTML at five timestamps in both portrait and landscape layouts. It also verifies deterministic snowfall, seamless loop endpoints, and the weekly-light mapping. See [`docs/extraction.md`](docs/extraction.md) for extraction boundaries, source provenance, intentional changes, and verification details.

```text
src/github.ts       GitHub → validated snapshot
src/snapshot.ts     Snapshot schema and offline demo
src/tree-state.ts   Snapshot → deterministic tree parameters
vendor/tree.js      Mechanically extracted original renderer
src/scene.ts        Tree scene and small image caption
src/export.ts       Chromium frames → GIF / PNG / preview
src/cli.ts          CLI commands
scripts/            Extraction and build
tests/              Calendar, collection, source parity, and export checks
```

The original artwork's source snapshot has no license file. Its provenance is preserved; no blanket license is asserted over the extracted artwork. The bundled JetBrains Mono font is distributed by `@fontsource/jetbrains-mono` under the SIL Open Font License; its notice is embedded in generated previews and copied beside exported files.
