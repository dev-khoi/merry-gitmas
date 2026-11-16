declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options: { palette?: number[][]; delay: number; repeat?: number; transparent?: boolean; transparentIndex?: number; dispose?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(data: Uint8Array, colors: number, options?: { format: string }): number[][];
  export function applyPalette(data: Uint8Array, palette: number[][], format?: string): Uint8Array;
}
