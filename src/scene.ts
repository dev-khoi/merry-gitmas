import { createTreeRenderer } from '../vendor/tree.js';
import type { TreeState } from './tree-state.js';
export { createTreeRenderer };

export function mount(canvas: HTMLCanvasElement, state: TreeState, options: { transparent?: boolean } = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable.');
  const treeCanvas = document.createElement('canvas');
  treeCanvas.width = canvas.width;
  const footer = Math.round(canvas.width * 0.18);
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
  const textCanvas = document.createElement('canvas');
  textCanvas.width = canvas.width;
  textCanvas.height = canvas.height;
  const text = textCanvas.getContext('2d', { willReadFrequently: true });
  if (!text) throw new Error('Text canvas 2D is unavailable.');
  function label(value: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
    text!.font = `bold ${size}px "JetBrains Mono", monospace`;
    text!.textAlign = align;
    text!.textBaseline = 'middle';
    text!.lineJoin = 'round';
    text!.lineWidth = 2.5;
    text!.strokeStyle = '#0d1117';
    text!.fillStyle = color;
    text!.strokeText(value, Math.round(x), Math.round(y), canvas.width - 28);
    text!.fillText(value, Math.round(x), Math.round(y), canvas.width - 28);
  }
  function draw(seconds: number, buildProgress = 1, crispText = false) {
    tree.draw(seconds, buildProgress);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.imageSmoothingEnabled = false;
    ctx!.drawImage(treeCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, treeCanvas.width, treeCanvas.height);
    if (!options.transparent) {
      ctx!.fillStyle = '#080e1b';
      ctx!.fillRect(0, treeCanvas.height, canvas.width, footer);
    }
    text!.clearRect(0, 0, canvas.width, canvas.height);
    const languageSize = Math.max(12, Math.round(canvas.width * 0.031));
    const placed: { x: number; y: number; width: number }[] = [];
    for (const gift of tree.giftLabels.filter(gift => gift.facing >= 0.35).sort((a, b) => a.y - b.y)) {
      text!.font = `bold ${languageSize}px "JetBrains Mono", monospace`;
      const width = Math.min(text!.measureText(gift.text).width, canvas.width - 28);
      const x = Math.max(width / 2 + 12, Math.min(canvas.width - width / 2 - 12, (gift.x - cropX) * zoom));
      let y = Math.min(treeCanvas.height - languageSize, (gift.y - cropY) * zoom + 4);
      for (const other of placed) {
        if (Math.abs(x - other.x) < (width + other.width) / 2 + 8 && Math.abs(y - other.y) < languageSize + 5) {
          y = Math.min(treeCanvas.height - languageSize, other.y + languageSize + 6);
          if (Math.abs(y - other.y) < languageSize + 5) y = other.y - languageSize - 6;
        }
      }
      placed.push({ x, y, width });
      label(gift.text, x, y, languageSize, gift.color);
    }
    label('made by dev-khoi', Math.max(16, canvas.width * 0.05), Math.max(22, canvas.width * 0.06), Math.max(11, Math.round(canvas.width * 0.029)), '#e1b494', 'left');
    label(`@${state.login} · ${state.year}${state.demo ? ' · DEMO' : ''}`, canvas.width / 2, treeCanvas.height + footer * 0.32, Math.max(13, Math.round(canvas.width * 0.036)), '#e0b34d');
    label(`${state.contributions.toLocaleString('en-US')} contributions · ${state.activeWeeks} active weeks`, canvas.width / 2, treeCanvas.height + footer * 0.7, Math.max(11, Math.round(canvas.width * 0.029)), '#cbd5e1');
    if (crispText) {
      // Keep text opaque in GIFs; only glows should use dotted alpha dithering.
      const image = text!.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] >= 96 ? 255 : 0;
      text!.putImageData(image, 0, 0);
    }
    ctx!.drawImage(textCanvas, 0, 0);
  }
  return { draw, counts: tree.counts };
}
