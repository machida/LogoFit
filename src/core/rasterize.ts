import { MAX_SOURCE_PIXELS, MAX_SOURCE_SIDE } from './limits';
import { sanitizeSvg } from './sanitizeSvg';

/** SVG ラスタライズ時の最長辺(px)。解析と出力に十分な解像度を確保する */
const SVG_BASE = 2048;
/** 巨大 PNG を扱う際の最長辺の上限(px) */
const PNG_MAX = 4096;

/**
 * PNG の IHDR から幅・高さを先読みする（先頭 24 バイトで判定）。
 * 解凍爆弾（小さい圧縮ファイルでも巨大寸法）を Image へ渡す前に弾くため。
 * PNG でない・壊れている場合は null を返す（呼び出し側で通常処理にフォールバック）。
 */
export function readPngSize(buffer: ArrayBuffer): { width: number; height: number } | null {
  if (buffer.byteLength < 24) return null;
  const view = new DataView(buffer);
  // PNG シグネチャ 89 50 4E 47 0D 0A 1A 0A
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) {
    if (view.getUint8(i) !== sig[i]) return null;
  }
  // IHDR は最初のチャンク：長さ(4) + "IHDR"(4) の後に width(4), height(4)（ビッグエンディアン）
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function assertWithinSourceLimits(width: number, height: number): void {
  if (width > MAX_SOURCE_SIDE || height > MAX_SOURCE_SIDE || width * height > MAX_SOURCE_PIXELS) {
    throw new Error(`画像の寸法が大きすぎます（${width}×${height}）`);
  }
}

export interface RasterResult {
  canvas: HTMLCanvasElement;
  kind: 'svg' | 'png';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = url;
  });
}

async function rasterizeSvg(text: string): Promise<HTMLCanvasElement> {
  const { svg, width, height } = sanitizeSvg(text);

  // 最長辺を SVG_BASE に合わせた解像度でラスタライズ
  const scale = SVG_BASE / Math.max(width, height);
  const rw = Math.max(1, Math.round(width * scale));
  const rh = Math.max(1, Math.round(height * scale));

  // 明示的な width/height/viewBox を付与して描画解像度を固定（拡大時のボケ防止）
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root.getAttribute('viewBox')) {
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  root.setAttribute('width', String(rw));
  root.setAttribute('height', String(rh));
  const finalSvg = new XMLSerializer().serializeToString(root);

  const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = rw;
    canvas.height = rh;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, rw, rh);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterizePng(file: File): Promise<HTMLCanvasElement> {
  // デコード前に IHDR で寸法を確認し、巨大画像は Image へ渡さず弾く
  const size = readPngSize(await file.arrayBuffer());
  if (size) assertWithinSourceLimits(size.width, size.height);

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) throw new Error('画像サイズを取得できませんでした');
    // IHDR を読めなかった場合のフォールバック（デコード後の寸法でも上限チェック）
    if (!size) assertWithinSourceLimits(w, h);
    const scale = Math.min(1, PNG_MAX / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** SVG / PNG ファイルを読み込み、解析・合成に使えるソースキャンバスへラスタライズする */
export async function rasterize(file: File): Promise<RasterResult> {
  const name = file.name.toLowerCase();
  const isSvg = file.type === 'image/svg+xml' || name.endsWith('.svg');
  const isPng = file.type === 'image/png' || name.endsWith('.png');

  if (isSvg) {
    const text = await file.text();
    return { canvas: await rasterizeSvg(text), kind: 'svg' };
  }
  if (isPng) {
    return { canvas: await rasterizePng(file), kind: 'png' };
  }
  throw new Error('対応していないファイル形式です（SVG / PNG のみ）');
}
