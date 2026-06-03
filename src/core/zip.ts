import JSZip from 'jszip';
import { canvasToPngBlob, composeToCanvas, outputFileName } from './compose';
import { MAX_TOTAL_OUTPUTS, outputTotals } from './limits';
import type { GlobalSettings, LogoItem, OutputPreset } from './types';

export interface GenerateProgress {
  done: number;
  total: number;
}

/**
 * 全ロゴ × 全プリセットの PNG を生成し、ZIP にまとめて Blob を返す。
 * onProgress で進捗（done/total）を通知する。
 */
export async function generateZip(
  items: LogoItem[],
  presets: OutputPreset[],
  settings: GlobalSettings,
  onProgress?: (p: GenerateProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const ready = items.filter((it) => it.status === 'ready' && it.source && it.analysis);
  // UI 判定とは独立に core 側でも総量上限を防御する（別経路から呼ばれても安全に）
  if (outputTotals(ready.length, presets).exceeds) {
    throw new Error(`総出力が上限（${MAX_TOTAL_OUTPUTS}枚 / 推定ピクセル）を超えています`);
  }
  const zip = new JSZip();
  const used = new Set<string>();
  const total = ready.length * presets.length;
  let done = 0;

  for (const preset of presets) {
    for (const item of ready) {
      // 1枚ごとに中止要求を確認（重いPNGが多いケースで途中停止できる）
      if (signal?.aborted) throw new DOMException('ZIP生成を中止しました', 'AbortError');
      const canvas = composeToCanvas(item, preset, settings);
      const blob = await canvasToPngBlob(canvas);

      let name = outputFileName(preset, item);
      // 同名衝突を回避
      if (used.has(name)) {
        const base = name.replace(/\.png$/i, '');
        let i = 2;
        while (used.has(`${base}_${i}.png`)) i++;
        name = `${base}_${i}.png`;
      }
      used.add(name);
      zip.file(name, blob);

      done++;
      onProgress?.({ done, total });
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

/** ブラウザでファイルダウンロードをトリガする */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
