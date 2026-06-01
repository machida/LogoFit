import { sanitizeSvg } from './sanitizeSvg';

/** SVG ラスタライズ時の最長辺(px)。解析と出力に十分な解像度を確保する */
const SVG_BASE = 2048;
/** 巨大 PNG を扱う際の最長辺の上限(px) */
const PNG_MAX = 4096;

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
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) throw new Error('画像サイズを取得できませんでした');
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
