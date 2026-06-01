import { analyze } from './analyze';
import { rasterize } from './rasterize';
import type { LogoItem } from './types';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `logo-${Date.now().toString(36)}-${counter}`;
}

export function baseNameOf(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '').replace(/[/\\]+/g, '_').trim() || 'logo';
}

/** File を読み込み、ラスタライズ + 解析まで済ませた LogoItem を返す */
export async function loadLogo(file: File): Promise<LogoItem> {
  const id = nextId();
  const base: LogoItem = {
    id,
    fileName: file.name,
    baseName: baseNameOf(file.name),
    kind: 'png',
    originalFile: file,
    source: null,
    analysis: null,
    areaOverride: null,
    status: 'loading',
  };

  try {
    const { canvas, kind } = await rasterize(file);
    const analysis = analyze(canvas);
    if (analysis.inkArea <= 0) {
      return { ...base, kind, status: 'error', error: '描画内容が検出できませんでした（透明のみ）' };
    }
    return { ...base, kind, source: canvas, analysis, status: 'ready' };
  } catch (err) {
    return { ...base, status: 'error', error: err instanceof Error ? err.message : '読み込みに失敗しました' };
  }
}
