import type { OutputPreset } from './types';

/**
 * 入力・出力の上限。ブラウザのメモリ枯渇やメインスレッドの長時間ブロックを避けるためのガードレール。
 * すべて「安全側のデフォルト」で、必要に応じて調整する。
 */

/** 1 ファイルあたりの最大バイト数（25MB） */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** 同時に保持できるロゴ数の上限 */
export const MAX_FILES = 300;
/** 出力プリセット数の上限 */
export const MAX_PRESETS = 24;

/**
 * デコード前にソース画像を拒否するための寸法上限。
 * 圧縮 PNG は小さいファイルでも巨大なピクセル寸法を持てる（解凍爆弾）ため、
 * Image へ渡す前に IHDR を先読みして弾く。
 */
export const MAX_SOURCE_SIDE = 12000;
export const MAX_SOURCE_PIXELS = 50_000_000;

/** ZIP に含める総出力枚数（ロゴ数 × プリセット数）の上限。ブラウザ内 ZIP 生成として安全側 */
export const MAX_TOTAL_OUTPUTS = 800;
/** 総出力ピクセル数の推定上限（Σ プリセット面積 × ロゴ数）。約 0.8G px */
export const MAX_TOTAL_OUTPUT_PIXELS = 800_000_000;
/** 解析（ラスタライズ + ピクセル走査）の同時実行数 */
export const ANALYZE_CONCURRENCY = 4;

/** バイト数を人間可読な MB 表記へ */
export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export interface OutputTotals {
  count: number;
  pixels: number;
  exceeds: boolean;
}

/** 総出力枚数・推定総ピクセルと、上限超過かどうかを返す（UI 判定の純関数化） */
export function outputTotals(readyCount: number, presets: OutputPreset[]): OutputTotals {
  const count = readyCount * presets.length;
  const pixels = readyCount * presets.reduce((sum, p) => sum + p.width * p.height, 0);
  return {
    count,
    pixels,
    exceeds: count > MAX_TOTAL_OUTPUTS || pixels > MAX_TOTAL_OUTPUT_PIXELS,
  };
}

/**
 * 配列を最大 limit 並列で非同期処理する。Promise.all の無制限同時実行を避ける。
 * 結果は入力順を保持する。shouldAbort() が true を返すと新規の処理開始を止める
 * （実行中のものは完了するが、それ以降はスケジュールしない）。
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  shouldAbort?: () => boolean,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      if (shouldAbort?.()) return;
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  };
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker);
  await Promise.all(workers);
  return results;
}
