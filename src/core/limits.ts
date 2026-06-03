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
/** ZIP に含める総出力枚数（ロゴ数 × プリセット数）の上限 */
export const MAX_TOTAL_OUTPUTS = 3000;
/** 総出力ピクセル数の推定上限（Σ プリセット面積 × ロゴ数）。約 2G px */
export const MAX_TOTAL_OUTPUT_PIXELS = 2_000_000_000;
/** 解析（ラスタライズ + ピクセル走査）の同時実行数 */
export const ANALYZE_CONCURRENCY = 4;

/** バイト数を人間可読な MB 表記へ */
export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 配列を最大 limit 並列で非同期処理する。Promise.all の無制限同時実行を避ける。
 * 結果は入力順を保持する。
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  };
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker);
  await Promise.all(workers);
  return results;
}
