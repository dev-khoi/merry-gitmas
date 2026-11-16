import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { collectSnapshot, resolveToken } from './github.js';
import { createDemoSnapshot, validateSnapshot } from './snapshot.js';
import { exportTree } from './export.js';

const help = `Merry Gitmas — your GitHub year, wrapped in ASCII lights.

Usage:
  merry-gitmas demo [options]                    Render an offline example
  merry-gitmas generate USERNAME [options]       Collect and render a real tree
  merry-gitmas collect USERNAME [options]        Save snapshot.json only
  merry-gitmas render SNAPSHOT.json [options]    Render a saved snapshot

Options:
  --year YEAR          Calendar year (default: current UTC year)
  --output-dir DIR     Destination (default: output)
  --width PIXELS       Image width, 240–1080 (default: 380)
  --height PIXELS      Image height, 300–1200 (default: 544)
  --fps NUMBER         GIF frames per second, 1–30 (default: 10)
  --still              PNG + interactive preview, skip GIF
  --help               Show this help

Live collection uses GH_TOKEN, GITHUB_TOKEN, or gh auth token.
Run npm run build and npx playwright install chromium before rendering.
`;

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    year: { type: 'string' }, 'output-dir': { type: 'string', default: 'output' },
    width: { type: 'string', default: '380' }, height: { type: 'string', default: '544' },
    fps: { type: 'string', default: '10' }, still: { type: 'boolean', default: false }, help: { type: 'boolean' },
  } });
  if (values.help || !positionals.length) { console.log(help); return; }
  const [command, argument] = positionals;
  if (!['demo', 'generate', 'collect', 'render'].includes(command)) throw new Error(`Unknown command: ${command}. Use --help.`);
  if (positionals.length !== (command === 'demo' ? 1 : 2)) throw new Error(`Unexpected or missing arguments for ${command}. Use --help.`);
  if ((command === 'demo' || command === 'render') && values.year) throw new Error(`${command} uses the year stored in its snapshot; omit --year.`);
  const outputDir = values['output-dir'];
  const snapshot = command === 'demo' ? createDemoSnapshot()
    : command === 'render' ? validateSnapshot(JSON.parse(await readFile(argument, 'utf8')))
    : await collectSnapshot(argument, values.year ? Number(values.year) : new Date().getUTCFullYear(), resolveToken());
  if (command === 'collect') {
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`Snapshot saved: ${path.resolve(outputDir, 'snapshot.json')}`);
    return;
  }
  await exportTree(snapshot, { outputDir, width: Number(values.width), height: Number(values.height), fps: Number(values.fps), still: values.still });
}

main().catch(error => { console.error(`Merry Gitmas: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
