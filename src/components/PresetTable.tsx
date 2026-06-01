import { Fragment, useState } from 'react';
import { innerBox } from '../core/margin';
import { MAX_OUTPUT_SIDE, normalizeDimension, normalizePreset } from '../core/preset';
import type { GlobalSettings, OutputPreset } from '../core/types';

interface Props {
  presets: OutputPreset[];
  settings: GlobalSettings;
  onChange: (presets: OutputPreset[]) => void;
  disabled?: boolean;
}

let presetCounter = 0;
function newPreset(): OutputPreset {
  presetCounter += 1;
  return { id: `p-${Date.now().toString(36)}-${presetCounter}`, prefix: 'new_', width: 800, height: 300 };
}

/**
 * プリセット寸法と全体設定から具体的な px 値を算出する。
 * - 余白 / 最大枠（余白の内側）は実際に縦横が決まるので 幅×高さ で表示
 * - 目標 / 最小は「面積」なので縦横は一意に決まらない → 面積等価の正方形の一辺(px四方)で目安表示
 */
function derivePx(preset: OutputPreset, settings: GlobalSettings) {
  const inner = innerBox(preset.width, preset.height, settings.margins);
  const innerW = inner.width;
  const innerH = inner.height;
  const innerArea = innerW * innerH;
  const { vertical, horizontal } = settings.margins;
  const side = (ratio: number) => Math.round(Math.sqrt(ratio * innerArea));
  return {
    margin: `上下 ${Math.round(vertical * preset.height)}px ・ 左右 ${Math.round(horizontal * preset.width)}px`,
    maxBox: `${Math.round(innerW)}×${Math.round(innerH)}px`,
    target: side(settings.targetAreaRatio),
    min: side(settings.minAreaRatio),
  };
}

function DimensionInput({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const next = normalizeDimension(Number(draft));
    setDraft(String(next));
    onCommit(next);
  };

  return (
    <input
      type="number"
      min={1}
      max={MAX_OUTPUT_SIDE}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

export function PresetTable({ presets, settings, onChange, disabled = false }: Props) {
  const update = (id: string, patch: Partial<OutputPreset>) => {
    onChange(presets.map((p) => (p.id === id ? normalizePreset({ ...p, ...patch }) : p)));
  };
  const remove = (id: string) => onChange(presets.filter((p) => p.id !== id));
  const add = () => onChange([...presets, newPreset()]);

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>出力プリセット</h2>
      </div>
      <div className="preset-table-wrap">
        <table className="preset-table">
          <tbody>
          {presets.map((p) => {
            const px = derivePx(p, settings);
            return (
              <Fragment key={p.id}>
                <tr>
                  <td>
                    <label className="preset-field">
                      <span>Prefix</span>
                      <input
                        type="text"
                        value={p.prefix}
                        disabled={disabled}
                        onChange={(e) => update(p.id, { prefix: e.target.value })}
                      />
                    </label>
                  </td>
                  <td>
                    <label className="preset-field">
                      <span>幅 (px)</span>
                      <DimensionInput
                        key={`width-${p.width}`}
                        value={p.width}
                        disabled={disabled}
                        onCommit={(width) => update(p.id, { width })}
                      />
                    </label>
                  </td>
                  <td className="preset-table__times" aria-hidden="true">
                    ×
                  </td>
                  <td>
                    <label className="preset-field">
                      <span>高さ (px)</span>
                      <DimensionInput
                        key={`height-${p.height}`}
                        value={p.height}
                        disabled={disabled}
                        onCommit={(height) => update(p.id, { height })}
                      />
                    </label>
                  </td>
                  <td className="preset-table__action">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => remove(p.id)}
                      disabled={disabled || presets.length <= 1}
                      title={presets.length <= 1 ? '最低1つ必要です' : '削除'}
                    >
                      ×
                    </button>
                  </td>
                </tr>
                <tr className="preset-derived">
                  <td colSpan={5}>
                    余白 {px.margin} ・ 最大 {px.maxBox} ・ 目標 {px.target}px四方 ・ 最小{' '}
                    {px.min}px四方
                  </td>
                </tr>
              </Fragment>
            );
          })}
          </tbody>
        </table>
      </div>
      <div className="panel__foot">
        <button className="btn btn--sm" onClick={add} disabled={disabled}>
          + プリセットを追加
        </button>
      </div>
    </div>
  );
}
