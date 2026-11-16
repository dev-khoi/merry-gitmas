import { fileURLToPath } from 'node:url';
import { createDemoSnapshot } from '../src/snapshot.js';
import { exportTree } from '../src/export.js';

const snapshot = createDemoSnapshot();
// More than 5,000 total and 100 recent contributions reach every growth cap.
snapshot.days.forEach(day => { day.count = 20; });
snapshot.languages.push(
  { name: 'Go', color: '#00add8', repositories: 2 },
  { name: 'Ruby', color: '#701516', repositories: 1 },
);

await exportTree(snapshot, {
  outputDir: fileURLToPath(new URL('../output/full/', import.meta.url)),
  width: 420,
  height: 600,
  fps: 10,
  still: false,
});
