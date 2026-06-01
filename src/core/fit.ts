import { innerBox } from './margin';
import type { GlobalSettings, LogoAnalysis, OutputPreset } from './types';

export type FitStatus =
  | 'ok' // 目標面積率どおりに収まった
  | 'raisedToMin' // 目標より小さいので最小面積まで拡大した
  | 'cappedByMargin'; // 余白上限で頭打ち（目標/最小に届かず）

export interface Placement {
  /** ソースキャンバスから切り出すトリム矩形 */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** 出力キャンバス上の配置（余白内の利用可能領域へ中央寄せ） */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  /** 実際に達成された面積率（参考表示用） */
  achievedAreaRatio: number;
  status: FitStatus;
}

/**
 * 視覚サイズ補正の中核。
 *
 * 目標：見た目の大きさ（= alpha 加重インク面積率）を、制約の範囲内で可能な限り揃える。
 *
 * 面積率の基準は「余白の内側（使える領域）」。余白は計算に含めない方が直感的なため。
 *
 * モデル：
 *   - 余白(margins)：ロゴはこの内側まで拡大できる = 実質の最大。これがハード上限。
 *   - 最小面積率(minAreaRatio)：内側面積に対する塗り面積の下限。
 *   - 目標面積率(targetAreaRatio)：内側面積に対する狙い。ロゴごとの areaOverride で個別調整。
 *
 *   f = clamp( 目標スケール, 最小面積スケール, 余白上限スケール )
 *   ただし余白上限は常に優先（最小面積が余白を超える細長ロゴは余白で頭打ち）。
 */
export function computePlacement(
  analysis: LogoAnalysis,
  preset: OutputPreset,
  settings: GlobalSettings,
  /** このロゴ個別の目標面積率。null なら全体設定に追従 */
  areaOverride: number | null,
): Placement | null {
  const { trim, inkArea } = analysis;
  if (inkArea <= 0 || trim.width <= 0 || trim.height <= 0) return null;

  const canvasW = preset.width;
  const canvasH = preset.height;

  // 余白の内側（使える領域）。面積率はこの領域を基準にする
  const inner = innerBox(canvasW, canvasH, settings.margins);
  const innerW = inner.width;
  const innerH = inner.height;
  const innerArea = innerW * innerH;

  // 面積率 r を満たすスケール：inkArea * f^2 = r * innerArea
  const scaleForRatio = (r: number) => Math.sqrt((r * innerArea) / inkArea);

  const targetRatio = areaOverride ?? settings.targetAreaRatio;
  const fTarget = scaleForRatio(targetRatio);
  const fMin = scaleForRatio(settings.minAreaRatio);

  // 余白で決まる最大スケール（内側に収まる上限）
  const fMargin = innerArea <= 0 ? 0 : Math.min(innerW / trim.width, innerH / trim.height);

  // 最小面積まで持ち上げ → 余白上限でクランプ（上限を常に優先）
  const fFloored = Math.max(fTarget, fMin);
  const f = Math.min(fFloored, fMargin);

  let status: FitStatus = 'ok';
  if (fFloored > fMargin) {
    status = 'cappedByMargin';
  } else if (fTarget < fMin) {
    status = 'raisedToMin';
  }

  const dw = trim.width * f;
  const dh = trim.height * f;
  const dx = inner.x + (innerW - dw) / 2;
  const dy = inner.y + (innerH - dh) / 2;
  const achievedAreaRatio = innerArea <= 0 ? 0 : (inkArea * f * f) / innerArea;

  return {
    sx: trim.x,
    sy: trim.y,
    sw: trim.width,
    sh: trim.height,
    dx,
    dy,
    dw,
    dh,
    achievedAreaRatio,
    status,
  };
}
