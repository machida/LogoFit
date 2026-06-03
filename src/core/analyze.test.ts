import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';

/** alpha 配列から analyze が必要とする最小限の canvas スタブを作る */
function canvasFromAlpha(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => number,
): HTMLCanvasElement {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[(y * width + x) * 4 + 3] = alphaAt(x, y);
    }
  }
  return {
    width,
    height,
    getContext: () => ({ getImageData: () => ({ data }) }),
  } as unknown as HTMLCanvasElement;
}

describe('analyze', () => {
  it('flags a fully opaque image (no transparent pixels)', () => {
    const result = analyze(canvasFromAlpha(10, 10, () => 255));
    expect(result.opaque).toBe(true);
    expect(result.inkArea).toBeGreaterThan(0);
  });

  it('does not flag an image with transparent margins and trims to ink bounds', () => {
    const result = analyze(canvasFromAlpha(10, 10, (x, y) => (x >= 3 && x < 7 && y >= 3 && y < 7 ? 255 : 0)));
    expect(result.opaque).toBe(false);
    expect(result.trim).toEqual({ x: 3, y: 3, width: 4, height: 4 });
  });

  it('returns inkArea 0 for a fully transparent image', () => {
    const result = analyze(canvasFromAlpha(8, 8, () => 0));
    expect(result.inkArea).toBe(0);
    expect(result.opaque).toBe(false);
  });
});
