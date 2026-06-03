import { useEffect, useRef } from 'react';
import { hasMargin, innerBox } from '../core/margin';
import type { GlobalSettings, OutputPreset } from '../core/types';

interface Props {
  settings: GlobalSettings;
  previewPreset: OutputPreset;
}

const BACKING_MAX = 480;

function backingSize(preset: OutputPreset): { w: number; h: number } {
  const s = Math.min(1, BACKING_MAX / Math.max(preset.width, preset.height));
  return {
    w: Math.max(1, Math.round(preset.width * s)),
    h: Math.max(1, Math.round(preset.height * s)),
  };
}

/**
 * ロゴ無しで設定（余白 / 目標 / 最小 / 背景）の効き具合だけを描く。
 * - 背景：transparent → CSSチェッカー、white → 塗り
 * - 余白：内側に破線矩形（最大）
 * - 目標面積：中央に面積等価の正方形（半透明塗り＋実線）
 * - 最小面積：中央に面積等価の正方形（点線輪郭）
 */
function draw(canvas: HTMLCanvasElement, settings: GlobalSettings, preset: OutputPreset) {
  const { w, h } = backingSize(preset);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('設定プレビューの 2D コンテキストを取得できませんでした');
    return;
  }
  ctx.clearRect(0, 0, w, h);

  if (settings.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }

  const inner = innerBox(w, h, settings.margins);
  const innerW = inner.width;
  const innerH = inner.height;
  const lw = Math.max(1, Math.min(w, h) * 0.006);

  // 目標面積（半透明塗り + 実線）
  if (settings.targetAreaRatio > 0 && innerW > 0 && innerH > 0) {
    const side = Math.sqrt(settings.targetAreaRatio * innerW * innerH);
    const sx = inner.x + (innerW - side) / 2;
    const sy = inner.y + (innerH - side) / 2;
    ctx.fillStyle = 'rgba(124, 58, 237, 0.22)';
    ctx.fillRect(sx, sy, side, side);
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.95)';
    ctx.setLineDash([]);
    ctx.strokeRect(sx, sy, side, side);
    ctx.restore();
  }

  // 最小面積（点線）
  if (settings.minAreaRatio > 0 && innerW > 0 && innerH > 0) {
    const side = Math.sqrt(settings.minAreaRatio * innerW * innerH);
    const sx = inner.x + (innerW - side) / 2;
    const sy = inner.y + (innerH - side) / 2;
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.setLineDash([Math.max(2, w * 0.008), Math.max(3, w * 0.012)]);
    ctx.strokeRect(sx, sy, side, side);
    ctx.restore();
  }

  // 余白（破線）
  if (hasMargin(settings.margins) && innerW > 0 && innerH > 0) {
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.setLineDash([Math.max(4, w * 0.02), Math.max(3, w * 0.014)]);
    ctx.strokeRect(inner.x, inner.y, innerW, innerH);
    ctx.restore();
  }
}

export function SettingsPreview({ settings, previewPreset }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) draw(ref.current, settings, previewPreset);
  }, [settings, previewPreset]);

  const checker = settings.background === 'transparent' ? ' checker-bg' : '';

  return (
    <div className="panel">
      <div className="panel__head">
        <h3>設定プレビュー</h3>
      </div>
      <div className="panel__body">
        <div className="frame-wrap">
          <canvas ref={ref} className={`frame-canvas${checker}`} />
        </div>
        <div className="frame-legend">
          <span className="lg lg--margin-gray">余白(最大)</span>
          <span className="lg lg--target">目標面積</span>
          <span className="lg lg--min">最小面積</span>
        </div>
        <p className="settings-preview__hint">
          枠 {previewPreset.width}×{previewPreset.height}・ロゴはこの内側に配置されます
        </p>
      </div>
    </div>
  );
}
