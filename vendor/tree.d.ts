import type { TreeState } from '../src/tree-state.js';
export function createTreeRenderer(canvas: HTMLCanvasElement, options?: {
  seed?: number;
  reference?: boolean;
  state?: TreeState;
  fontFamily?: string;
  bottomPadding?: number;
  transparent?: boolean;
  theme?: 'dark' | 'light';
}): {
  draw(seconds: number, buildProgress?: number, dt?: number): void;
  counts: Record<string, number>;
  readonly giftLabels: { text: string; x: number; y: number; color: string; facing: number }[];
  geometry: Record<string, ArrayLike<number>>;
  weekLights: { index: number; count: number; longest: boolean; startsOn: string }[];
};
