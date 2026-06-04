// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_SOURCE_PIXELS, MAX_SOURCE_SIDE } from './limits';
import { rasterize, readPngSize } from './rasterize';

/** 指定した幅・高さを IHDR に持つ最小の PNG ヘッダ（先頭24バイト）を作る */
function makePngHeader(width: number, height: number): ArrayBuffer {
  const buffer = new ArrayBuffer(24);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  const view = new DataView(buffer);
  view.setUint32(8, 13); // IHDR length
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buffer;
}

function bufferOf(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length);
  new Uint8Array(buffer).set(values);
  return buffer;
}

const pngFile = (width: number, height: number) =>
  new File([makePngHeader(width, height)], 'x.png', { type: 'image/png' });

describe('readPngSize', () => {
  it('reads width/height from a PNG IHDR', () => {
    expect(readPngSize(makePngHeader(640, 480))).toEqual({ width: 640, height: 480 });
  });

  it('returns null for non-PNG data', () => {
    expect(readPngSize(bufferOf([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
  });
});

describe('rasterize source limits', () => {
  it('rejects a PNG whose side exceeds MAX_SOURCE_SIDE before decoding', async () => {
    await expect(rasterize(pngFile(MAX_SOURCE_SIDE + 1, 10))).rejects.toThrow(/寸法/);
  });

  it('rejects a PNG whose total pixels exceed MAX_SOURCE_PIXELS', async () => {
    // 各辺は MAX_SOURCE_SIDE 以下だが、面積が上限超過になる組み合わせ
    const side = Math.min(MAX_SOURCE_SIDE, 10000);
    const tall = Math.ceil(MAX_SOURCE_PIXELS / side) + 1;
    await expect(rasterize(pngFile(side, Math.min(tall, MAX_SOURCE_SIDE)))).rejects.toThrow(/寸法/);
  });
});

describe('rasterize file type detection', () => {
  it('reports the supported formats in the unsupported-file error', async () => {
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    await expect(rasterize(file)).rejects.toThrow('SVG / PNG / PDF / AI');
  });
});

describe('rasterize .ai handling', () => {
  it('rejects a non-PDF-compatible (old) .ai with guidance', async () => {
    // %PDF を含まない＝PDF互換でない古い .ai（EPS ベース）
    const file = new File(['%!PS-Adobe-3.0 EPSF-3.0\n%%Creator: Adobe Illustrator\n'], 'old.ai', {
      type: 'application/postscript',
    });
    await expect(rasterize(file)).rejects.toThrow(/PDF 互換/);
  });
});
