import { useEffect, useRef } from 'react';
import { composeToCanvas } from '../core/compose';
import { computePlacement } from '../core/fit';
import { hasMargin, innerBox } from '../core/margin';
import type { GlobalSettings, LogoItem, OutputPreset } from '../core/types';

interface Props {
  item: LogoItem;
  previewPreset: OutputPreset;
  settings: GlobalSettings;
  previewWhiteBackground: boolean;
  disabled?: boolean;
  onBaseNameChange: (baseName: string) => void;
  /** このロゴの目標面積率を更新（null で全体設定に追従） */
  onAreaChange: (ratio: number | null) => void;
  onRemove: () => void;
}

/** 補正後フレームのバッキング解像度の最長辺(px)。CSS で枠に合わせて縮小表示する */
const FRAME_BACKING_MAX = 640;
/** 元ロゴサムネイルのバッキング解像度の最長辺(px) */
const THUMB_BACKING_MAX = 240;

function backingSize(preset: OutputPreset): { w: number; h: number } {
  const s = Math.min(1, FRAME_BACKING_MAX / Math.max(preset.width, preset.height));
  return {
    w: Math.max(1, Math.round(preset.width * s)),
    h: Math.max(1, Math.round(preset.height * s)),
  };
}

/** ソースのトリム領域をサムネイルにフィット描画する（元ロゴの確認用） */
function drawOriginal(canvas: HTMLCanvasElement, item: LogoItem) {
  if (!item.source || !item.analysis) return;
  const { trim } = item.analysis;
  const scale = Math.min(1, THUMB_BACKING_MAX / Math.max(trim.width, trim.height));
  canvas.width = Math.max(1, Math.round(trim.width * scale));
  canvas.height = Math.max(1, Math.round(trim.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    item.source,
    trim.x,
    trim.y,
    trim.width,
    trim.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

/**
 * 補正後フレームを描画する。
 * バッキングをプリセットと同じ縦横比にし、合成結果を全面へ描く。
 * → CSS で 100% 表示すれば「枠の実寸比 + その中のロゴサイズ + 背景色」がそのまま見える。
 * さらに余白(最大)と最小面積のガイドをオーバーレイして制約を視覚化する。
 */
function drawFrame(
  canvas: HTMLCanvasElement,
  item: LogoItem,
  preset: OutputPreset,
  settings: GlobalSettings,
  previewWhiteBackground: boolean,
) {
  const { w, h } = backingSize(preset);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const previewSettings = previewWhiteBackground ? { ...settings, background: 'white' as const } : settings;
  const composed = composeToCanvas(item, preset, previewSettings);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(composed, 0, 0, composed.width, composed.height, 0, 0, w, h);

  const inner = innerBox(w, h, settings.margins);
  const innerW = inner.width;
  const innerH = inner.height;
  const lw = Math.max(1, Math.min(w, h) * 0.006);

  // 余白(最大)の境界：破線
  if (hasMargin(settings.margins) && innerW > 0 && innerH > 0) {
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(91,140,255,0.95)';
    ctx.setLineDash([Math.max(4, w * 0.02), Math.max(3, w * 0.014)]);
    ctx.strokeRect(inner.x, inner.y, innerW, innerH);
    ctx.restore();
  }

  // 最小面積の参照：面積が等価な正方形（点線）
  if (settings.minAreaRatio > 0 && innerW > 0 && innerH > 0) {
    const side = Math.sqrt(settings.minAreaRatio * innerW * innerH);
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(255,196,107,0.95)';
    ctx.setLineDash([Math.max(2, w * 0.008), Math.max(3, w * 0.012)]);
    ctx.strokeRect(inner.x + (innerW - side) / 2, inner.y + (innerH - side) / 2, side, side);
    ctx.restore();
  }
}

const STATUS_VIEW: Record<string, { label: string; cls: string }> = {
  ok: { label: '', cls: '' },
  raisedToMin: { label: '（最小）', cls: ' ratio--min' },
  cappedByMargin: { label: '（余白上限）', cls: ' ratio--margin' },
};

export function LogoPreview({
  item,
  previewPreset,
  settings,
  previewWhiteBackground,
  disabled = false,
  onBaseNameChange,
  onAreaChange,
  onRemove,
}: Props) {
  const origRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (origRef.current) drawOriginal(origRef.current, item);
  }, [item]);

  useEffect(() => {
    if (frameRef.current) drawFrame(frameRef.current, item, previewPreset, settings, previewWhiteBackground);
  }, [item, previewPreset, settings, previewWhiteBackground]);

  const placement =
    item.analysis && computePlacement(item.analysis, previewPreset, settings, item.areaOverride);

  const effectiveRatio = item.areaOverride ?? settings.targetAreaRatio;
  const isOverridden = item.areaOverride != null;
  const minPct = Math.round(settings.minAreaRatio * 100);
  const displayedRatio = placement?.achievedAreaRatio ?? effectiveRatio;

  // このロゴで実際に到達できる面積率の上限（余白上限まで広げた時の達成率）でクランプ。
  // これより上は余白で頭打ちになるだけなのでスライダーをそこで止める。
  const maxPctReachable = (() => {
    if (!item.analysis) return 100;
    const inner = innerBox(previewPreset.width, previewPreset.height, settings.margins);
    const innerW = inner.width;
    const innerH = inner.height;
    const innerArea = innerW * innerH;
    const { trim, inkArea } = item.analysis;
    if (innerArea <= 0 || inkArea <= 0 || trim.width <= 0 || trim.height <= 0) return minPct;
    const fMargin = Math.min(innerW / trim.width, innerH / trim.height);
    const ratio = (inkArea * fMargin * fMargin) / innerArea;
    return Math.max(minPct, Math.floor(ratio * 100));
  })();
  const sliderValue = Math.min(Math.round(effectiveRatio * 100), maxPctReachable);

  if (item.status === 'error') {
    return (
      <div className="logo-card logo-card--error">
        <header className="logo-card__head">
          <span className="logo-card__name">{item.fileName}</span>
          <button className="btn btn--sm logo-card__remove" onClick={onRemove} title="削除" disabled={disabled}>
            ×
          </button>
        </header>
        <div className="logo-card__body">
          <div className="logo-card__err">⚠ {item.error}</div>
        </div>
      </div>
    );
  }

  const transparent = settings.background === 'transparent' && !previewWhiteBackground;
  const checker = transparent ? ' checker-bg' : '';

  return (
    <div className="logo-card">
      <header className="logo-card__head">
        <input
          className="logo-card__name-input"
          type="text"
          value={item.baseName}
          disabled={disabled}
          onChange={(e) => onBaseNameChange(e.target.value)}
          aria-label="ファイル名（拡張子を除く）"
        />
        <span className="logo-card__extension">.{item.kind}</span>
        <span className={`badge badge--${item.kind}`}>{item.kind.toUpperCase()}</span>
        <button className="btn btn--sm logo-card__remove" onClick={onRemove} title="削除" disabled={disabled}>
          ×
        </button>
      </header>

      <div className="logo-card__body">
        <div className="preview">
          <figure className="preview__orig">
            <canvas ref={origRef} className="thumb-canvas checker-bg" />
            <figcaption>
              元（余白除去後）
              {item.analysis && (
                <span className="dim">
                  {' '}
                  {item.analysis.trim.width}×{item.analysis.trim.height}
                </span>
              )}
            </figcaption>
          </figure>

          <figure className="preview__frame">
            <div className="frame-wrap">
              <canvas ref={frameRef} className={`frame-canvas${checker}`} />
            </div>
            <div className="frame-legend">
              <span className="lg lg--margin">余白(最大)</span>
              <span className="lg lg--min">最小面積</span>
            </div>
          </figure>
        </div>
        <div className="preview__details">
          <span className="dim">
            枠 {previewPreset.width}×{previewPreset.height}
          </span>
          {placement && (
            <>
              {' ・ ロゴ '}
              {Math.round(placement.dw)}×{Math.round(placement.dh)}
              {' ・ '}
              <span className={`ratio${STATUS_VIEW[placement.status].cls}`}>
                面積 {Math.round(placement.achievedAreaRatio * 100)}%
                {STATUS_VIEW[placement.status].label}
              </span>
            </>
          )}
        </div>

        <div className="logo-card__scale">
          <div className="scale-row">
            <span>このロゴの面積率{isOverridden ? '' : '（全体に追従）'}</span>
            <strong className={isOverridden ? 'overridden' : ''}>
              {Math.round(displayedRatio * 100)}%
            </strong>
          </div>
          <input
            type="range"
            min={minPct}
            max={maxPctReachable}
            value={sliderValue}
            disabled={disabled}
            onChange={(e) => onAreaChange(Number(e.target.value) / 100)}
          />
          <div className="scale-foot">
            <span className="field__hint">塗り面積で指定（余白の内側基準）</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => onAreaChange(null)}
              disabled={disabled || !isOverridden}
              title="全体の目標面積率に追従させる"
            >
              全体に戻す
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
