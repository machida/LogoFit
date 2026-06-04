import { MAX_SOURCE_PIXELS, MAX_SOURCE_SIDE } from './limits';
import { sanitizeSvg } from './sanitizeSvg';

/** SVG ラスタライズ時の最長辺(px)。解析と出力に十分な解像度を確保する */
const SVG_BASE = 2048;
/** PDF ラスタライズ時の最長辺(px)。初期対応は1ページ目をこの解像度へ固定 */
const PDF_BASE = 2048;
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
  kind: 'svg' | 'png' | 'pdf' | 'ai';
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
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ラスタライズ用Canvasを作成できませんでした');
    ctx.drawImage(img, 0, 0, rw, rh);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterizePng(file: File): Promise<HTMLCanvasElement> {
  // デコード前に IHDR で寸法を確認し、巨大画像は Image へ渡さず弾く。
  // 必要なのは先頭 24 バイト（署名 + IHDR の幅・高さ）だけなので全体は読まない。
  const size = readPngSize(await file.slice(0, 24).arrayBuffer());
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
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ラスタライズ用Canvasを作成できませんでした');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterizePdf(file: File): Promise<HTMLCanvasElement> {
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = worker.default;

  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  try {
    if (pdf.numPages < 1) throw new Error('PDF にページがありません');

    // 初期対応はロゴ素材として届いた PDF の1ページ目のみを使う。
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    if (!baseViewport.width || !baseViewport.height) {
      throw new Error('PDF のページサイズを取得できませんでした');
    }
    const scale = PDF_BASE / Math.max(baseViewport.width, baseViewport.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ラスタライズ用Canvasを作成できませんでした');
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas;
  } finally {
    await pdf.cleanup();
    await loadingTask.destroy();
  }
}

/**
 * Illustrator の .ai をラスタライズする。
 * モダンな .ai は既定で「PDF互換」保存され中身に PDF ストリームを含むため pdf.js で描画できる。
 * 古い（PDF非互換）.ai は対象外。先頭を覗いて %PDF が無ければ明示エラーにする。
 */
async function rasterizeAi(file: File): Promise<HTMLCanvasElement> {
  const head = await file.slice(0, 1024).text();
  if (!head.includes('%PDF-')) {
    throw new Error(
      'この .ai は PDF 互換で保存されていないため読み込めません。Illustrator で「PDF互換ファイルを作成」を有効にして保存し直すか、SVG / PDF で書き出してください。',
    );
  }
  try {
    return await rasterizePdf(file);
  } catch (err) {
    throw new Error(
      '.ai の読み込みに失敗しました。PDF 互換で保存し直すか、SVG / PDF で書き出してください。',
      { cause: err },
    );
  }
}

/** SVG / PNG / PDF / AI ファイルを読み込み、解析・合成に使えるソースキャンバスへラスタライズする */
export async function rasterize(file: File): Promise<RasterResult> {
  const name = file.name.toLowerCase();
  const isSvg = file.type === 'image/svg+xml' || name.endsWith('.svg');
  const isPng = file.type === 'image/png' || name.endsWith('.png');
  // .ai は PDF より先に判定する（.ai が application/pdf 等で届くことがあるため）
  const isAi =
    name.endsWith('.ai') ||
    file.type === 'application/illustrator' ||
    file.type === 'application/postscript';
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');

  if (isSvg) {
    const text = await file.text();
    return { canvas: await rasterizeSvg(text), kind: 'svg' };
  }
  if (isAi) {
    return { canvas: await rasterizeAi(file), kind: 'ai' };
  }
  if (isPng) {
    return { canvas: await rasterizePng(file), kind: 'png' };
  }
  if (isPdf) {
    return { canvas: await rasterizePdf(file), kind: 'pdf' };
  }
  throw new Error('対応していないファイル形式です（SVG / PNG / PDF / AI のみ）');
}
