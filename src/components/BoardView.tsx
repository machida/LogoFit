import { useEffect, useRef } from 'react';
import { composeToCanvas } from '../core/compose';
import type { GlobalSettings, LogoItem, OutputPreset } from '../core/types';

interface Props {
  items: LogoItem[];
  previewPreset: OutputPreset;
  settings: GlobalSettings;
  previewWhiteBackground: boolean;
}

/** タイルのバッキング解像度の最長辺(px) */
const TILE_BACKING_MAX = 480;

function FrameTile({
  item,
  preset,
  settings,
  previewWhiteBackground,
}: {
  item: LogoItem;
  preset: OutputPreset;
  settings: GlobalSettings;
  previewWhiteBackground: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const s = Math.min(1, TILE_BACKING_MAX / Math.max(preset.width, preset.height));
    const w = Math.max(1, Math.round(preset.width * s));
    const h = Math.max(1, Math.round(preset.height * s));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('並べて表示の 2D コンテキストを取得できませんでした');
      return;
    }
    const previewSettings = previewWhiteBackground ? { ...settings, background: 'white' as const } : settings;
    const composed = composeToCanvas(item, preset, previewSettings);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(composed, 0, 0, composed.width, composed.height, 0, 0, w, h);
  }, [item, preset, settings, previewWhiteBackground]);

  const checker = settings.background === 'transparent' && !previewWhiteBackground ? ' checker-bg' : '';

  return (
    <figure className="tile">
      <canvas ref={ref} className={`tile-canvas${checker}`} />
      <figcaption title={item.fileName}>{item.fileName}</figcaption>
    </figure>
  );
}

/**
 * 書き出し前のバランス確認用。選択中プリセット枠に全ロゴを敷き詰めて表示する。
 * 実際の一覧の見え方に近づけるため、ガイド等は出さずクリーンに描画する。
 */
export function BoardView({ items, previewPreset, settings, previewWhiteBackground }: Props) {
  const ready = items.filter((it) => it.status === 'ready' && it.source && it.analysis);

  if (ready.length === 0) {
    return (
      <div className="empty">
        <p>表示できるロゴがありません。</p>
      </div>
    );
  }

  return (
    <div className="board">
      <div className="board__head dim">
        {previewPreset.prefix} 枠 {previewPreset.width}×{previewPreset.height} に全 {ready.length} ロゴを配置
      </div>
      <div className="board__grid">
        {ready.map((it) => (
          <FrameTile
            key={it.id}
            item={it}
            preset={previewPreset}
            settings={settings}
            previewWhiteBackground={previewWhiteBackground}
          />
        ))}
      </div>
    </div>
  );
}
