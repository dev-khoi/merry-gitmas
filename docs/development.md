# Development and customization

## Build before rendering

After changing `src/` or switching commits, run:

```sh
npm run build
```

The CLI runs from `dist/`, and exports embed `dist/scene.js`. Both `dist/` and generated image folders are ignored by Git. Reverting source does not replace existing builds or images.

## Render saved data

Collect once, then render without another GitHub request:

```sh
node dist/cli.js collect dev-khoi --output-dir output/data
node dist/cli.js render output/data/snapshot.json --output-dir output/example
```

Copy and edit a snapshot to experiment with contribution totals, streaks, or languages. Keep every daily date in place and change only its count. Render each experiment to a separate folder.

For a maximum-growth demo:

```sh
npx tsx scripts/generate-full-example.ts
```

This writes illustrative data and artwork into `output/full/`.

## Export options

```sh
node dist/cli.js generate dev-khoi --year 2025 --output-dir output/2025
node dist/cli.js demo --width 480 --height 680 --fps 15
node dist/cli.js demo --still
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--year` | Current UTC year | Used by `generate` and `collect` |
| `--output-dir` | `output` | Destination folder |
| `--width` | `420` | Image width, 240–1080 pixels |
| `--height` | `600` | Image height, 300–1200 pixels |
| `--fps` | `10` | GIF frame rate, 1–30 |
| `--still` | Off | Generate PNG and preview, skip GIF |

`--still` does not delete a GIF left from a previous run. Saved snapshots determine their own year, so do not pass `--year` to `render` or `demo`.

On January 1, the current year has no completed UTC day yet; select the previous year explicitly.

## Appearance controls

- **`src/tree-state.ts`:** contribution-to-size/fullness mapping and recent-activity strength. Growth is capped at 5,000 contributions; recent activity is capped at 100 contributions in seven observed days.
- **`src/scene.ts`:** framing, crop zoom, padding, captions, and credits.
- **`scripts/extract-tree.mjs`:** renderer adaptations, such as star aura, snow, gift behavior, ornament size, and trunk radius.

Scale changes overall size. Fullness in the current renderer filters existing needle points and limits branch reach; values above 1 do not create more branches. Keep fullness in the 0–1 range. The star aura currently peaks at 1.7× its base sprite size.

Language labels and captions are drawn as bold, outlined text at the final image resolution, separately from the ASCII tree. The GIF keeps text opaque rather than applying glow dithering to its letter edges. For the sharpest README text, display the default export at its native width of 420 pixels.

After editing the extraction script, regenerate the renderer and build:

```sh
node scripts/extract-tree.mjs vendor/original.html
npm run build
```

Then render your snapshot again. See [extraction details](extraction.md) for the source and reference mode.

## GitHub Actions

### This repository

`.github/workflows/ci.yml` generates **dev-khoi** on push and nightly at 02:17 UTC. Manual runs accept a username and optional year. It runs the local action (`uses: ./`), so changes are rendered from the current checkout without waiting for a release.

Default-branch runs commit outputs into `gitmas/`. Other branches upload an artifact without committing generated files. Changes only inside `gitmas/` do not trigger another push run. Pull requests run TypeScript and build checks without live account collection.

The workflow uses the built-in GitHub token. It writes to this repository, not to `dev-khoi/dev-khoi`. Install the profile workflow separately if you want nightly updates there too.

Publishing fetches full history, rebases its generated-file commit onto the latest remote branch, and retries the push up to three times. This handles other workflows or edits pushing while the tree renders. If an older workflow fails with `fetch first` or `non-fast-forward`, replace it with the current example and start a new run; rerunning the failed job alone still uses its older workflow definition. A rebase conflict needs to be resolved rather than force-pushing over remote changes.

### Reusable action

The [profile workflow](../examples/profile-workflow.yml) uses `dev-khoi/merry-gitmas@main`. You can pin a published tag or commit instead. It starts when its workflow file is pushed, runs nightly, and can be triggered manually.

| Input | Default |
| --- | --- |
| `login` | Owner of the calling repository |
| `year` | Current UTC year |
| `output-dir` | `gitmas` |
| `token` | Built-in GitHub token |
| `fps` | `10` |

Every export generates both themes: `tree.gif` and `tree.png` for dark backgrounds, plus `tree-light.gif` and `tree-light.png` for light backgrounds. Both GIFs share the same timing. Use the README's `<picture>` embed to select automatically. `--still` generates both PNGs without GIFs.

The action generates files; the calling workflow commits them. Its outputs are `gif`, `png`, `gif-light`, `png-light`, and `preview` paths. Existing profile workflows need to add the two light-mode files to their commit step; see the updated example. Use `ubuntu-latest`; the action installs Node.js and Chromium dependencies.

## Source layout

```text
src/github.ts         Collect GitHub data
src/snapshot.ts       Validate snapshots and provide demo data
src/tree-state.ts     Calculate appearance settings
src/scene.ts          Compose the tree and captions
src/export.ts         Export GIF, PNG, and preview
src/cli.ts            CLI commands
vendor/tree.js        Generated renderer
scripts/              Build, extraction, and example generation
```

The bundled JetBrains Mono font uses the SIL Open Font License. Its notice is included in previews and exported files. Source-renderer provenance is recorded in `vendor/source.json`.
