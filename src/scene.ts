import { createTreeRenderer } from '../vendor/tree.js';
import type { TreeState } from './tree-state.js';
export { createTreeRenderer };

export function mount(canvas: HTMLCanvasElement, state: TreeState, options: { transparent?: boolean } = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable.');
  const treeCanvas = document.createElement('canvas');
  treeCanvas.width = canvas.width;
  const footer = Math.round(canvas.width * 0.15);
  treeCanvas.height = canvas.height - footer;
  const bottomPadding = Math.min(48, treeCanvas.height * 0.1);
  const layoutHeight = treeCanvas.height - bottomPadding;
  const tree = createTreeRenderer(treeCanvas, { seed: state.seed, state, fontFamily: '"JetBrains Mono", monospace', bottomPadding, transparent: options.transparent });
  // Bottom-anchor the crop so the spare sky is removed rather than the gifts.
  const zoom = 1.2;
  const cropWidth = treeCanvas.width / zoom;
  const cropHeight = treeCanvas.height / zoom;
  const cropX = (treeCanvas.width - cropWidth) / 2;
  // Preserve the existing top crop, extending the visible ground underneath it.
  const cropY = layoutHeight - layoutHeight / zoom;
  function draw(seconds: number, buildProgress = 1) {
    tree.draw(seconds, buildProgress);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.imageSmoothingEnabled = false;
    ctx!.drawImage(treeCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, treeCanvas.width, treeCanvas.height);
    ctx!.textAlign = 'left';
    ctx!.textBaseline = 'top';
    ctx!.font = `${Math.max(9, canvas.width * 0.024)}px "JetBrains Mono", monospace`;
    ctx!.fillStyle = '#94a3b8';
    ctx!.fillText('made by dev-khoi', Math.max(16, canvas.width * 0.05), Math.max(16, canvas.width * 0.05));
    if (!options.transparent) {
      ctx!.fillStyle = '#080e1b';
      ctx!.fillRect(0, treeCanvas.height, canvas.width, footer);
    }
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.font = `${Math.max(9, canvas.width * 0.029)}px "JetBrains Mono", monospace`;
    ctx!.fillStyle = '#e0b34d';
    ctx!.fillText(`@${state.login} · ${state.year}${state.demo ? ' · DEMO' : ''}`, canvas.width / 2, treeCanvas.height + footer * 0.32, canvas.width - 24);
    ctx!.font = `${Math.max(8, canvas.width * 0.024)}px "JetBrains Mono", monospace`;
    ctx!.fillStyle = '#94a3b8';
    ctx!.fillText(`${state.contributions.toLocaleString('en-US')} contributions · ${state.activeWeeks} active weeks`, canvas.width / 2, treeCanvas.height + footer * 0.7, canvas.width - 24);
  }
  return { draw, counts: tree.counts };
}
