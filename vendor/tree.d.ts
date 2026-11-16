import type { TreeState } from '../src/tree-state.js';
export function createTreeRenderer(canvas: HTMLCanvasElement, options?: {
  seed?: number;
  reference?: boolean;
  state?: TreeState;
  fontFamily?: string;
  bottomPadding?: number;
  transparent?: boolean;
}): {
  draw(seconds: number, buildProgress?: number, dt?: number): void;
  counts: Record<string, number>;
  geometry: Record<string, ArrayLike<number>>;
  weekLights: { index: number; count: number; longest: boolean; startsOn: string }[];
};
