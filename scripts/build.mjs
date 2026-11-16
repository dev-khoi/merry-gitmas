import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await Promise.all([
  build({ absWorkingDir: root, entryPoints: ['src/cli.ts'], outfile: 'dist/cli.js', bundle: true, platform: 'node', format: 'esm', packages: 'external', banner: { js: '#!/usr/bin/env node' } }),
  build({ absWorkingDir: root, entryPoints: ['src/scene.ts'], outfile: 'dist/scene.js', bundle: true, platform: 'browser', format: 'iife', globalName: 'MerryGitmas', target: 'es2022' }),
  copyFile(new URL('../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', import.meta.url), new URL('../dist/jetbrains-mono.woff2', import.meta.url)),
  copyFile(new URL('../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2', import.meta.url), new URL('../dist/jetbrains-mono-bold.woff2', import.meta.url)),
  copyFile(new URL('../node_modules/@fontsource/jetbrains-mono/LICENSE', import.meta.url), new URL('../dist/FONT-LICENSE.txt', import.meta.url)),
]);
console.log('Built CLI, browser renderer, and bundled JetBrains Mono font.');
