import type { LogoAnalysis } from './types';

/** これ未満の alpha は「完全透明扱い」としてトリム判定から除外する */
const ALPHA_THRESHOLD = 10;

/**
 * ソースキャンバスを解析する。
 * - 非透明ピクセルのバウンディングボックス（透明余白を除去した実描画範囲）
 * - alpha 加重のインク面積（半透明は alpha に比例して面積に算入）
 */
export function analyze(canvas: HTMLCanvasElement): LogoAnalysis {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let inkArea = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;
      inkArea += alpha / 255;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // 完全に透明（インクが無い）場合
  if (maxX < 0) {
    return {
      sourceWidth: width,
      sourceHeight: height,
      trim: { x: 0, y: 0, width, height },
      inkArea: 0,
    };
  }

  return {
    sourceWidth: width,
    sourceHeight: height,
    trim: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    inkArea,
  };
}
