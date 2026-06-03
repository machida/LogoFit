import { computePlacement } from './fit';
import { isValidPreset } from './preset';
import type { GlobalSettings, LogoItem, OutputPreset } from './types';

/**
 * 1 ロゴ × 1 プリセットを合成してキャンバスを返す。
 * 補正後ロゴを余白内の利用可能領域へ中央寄せし、背景設定を反映する。
 * インクが無い等で配置できない場合は背景のみのキャンバスを返す。
 */
export function composeToCanvas(
  item: LogoItem,
  preset: OutputPreset,
  settings: GlobalSettings,
): HTMLCanvasElement {
  if (!isValidPreset(preset)) throw new Error('出力サイズが大きすぎます');
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('出力用Canvasを作成できませんでした');

  if (settings.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (!item.source || !item.analysis) return canvas;
  const placement = computePlacement(item.analysis, preset, settings, item.areaOverride);
  if (!placement) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    item.source,
    placement.sx,
    placement.sy,
    placement.sw,
    placement.sh,
    placement.dx,
    placement.dy,
    placement.dw,
    placement.dh,
  );

  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG の生成に失敗しました'));
    }, 'image/png');
  });
}

/** Windows/macOS/Linux で扱いにくい文字 */
const ILLEGAL_CHARS = '<>:"/\\|?*';
/** 拡張子を除いたファイル名の最大長（マルチバイトでも安全側の文字数で丸める） */
const MAX_BASE_LENGTH = 120;

/** OS 横断で安全なファイル名要素にする（制御文字・不正文字を _ へ、前後の空白/ドットを除去） */
function cleanComponent(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f || ILLEGAL_CHARS.includes(ch) ? '_' : ch;
  }
  return out.replace(/^[\s.]+|[\s.]+$/g, '');
}

export function outputFileName(preset: OutputPreset, item: LogoItem): string {
  const prefix = cleanComponent(preset.prefix);
  const base = cleanComponent(item.baseName) || 'logo';
  let name = `${prefix}${base}`;
  if (name.length > MAX_BASE_LENGTH) name = name.slice(0, MAX_BASE_LENGTH).replace(/[\s.]+$/g, '');
  return `${name || 'logo'}.png`;
}
