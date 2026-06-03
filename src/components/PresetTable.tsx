import { Fragment, useState } from 'react';
import { MAX_PRESETS } from '../core/limits';
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
  const [lastValue, setLastValue] = useState(value);

  // 外部から value が更新されたら描画時にドラフトへ同期（effect を使わない React 公式パターン）。
  // 編集確定や下書き復旧で同じ値に正規化された場合も反映される。
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

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
  const [showDerived, setShowDerived] = useState(false);
  const update = (id: string, patch: Partial<OutputPreset>) => {
    onChange(presets.map((p) => (p.id === id ? normalizePreset({ ...p, ...patch }) : p)));
  };
  const remove = (id: string) => onChange(presets.filter((p) => p.id !== id));
  const add = () => {
    if (presets.length >= MAX_PRESETS) return;
    onChange([...presets, newPreset()]);
  };
  const atPresetLimit = presets.length >= MAX_PRESETS;

  return (
    <div className="panel">
      <div className="panel__head">
        <h3>出力プリセット</h3>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          aria-expanded={showDerived}
          onClick={() => setShowDerived((v) => !v)}
        >
          {showDerived ? 'px換算を隠す' : 'px換算を表示'}
        </button>
      </div>
      <div className="preset-table-wrap">
        <table className={`preset-table${showDerived ? '' : ' preset-table--flat'}`}>
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
                      <span>幅</span>
                      <span className="dim-input">
                        <DimensionInput
                          value={p.width}
                          disabled={disabled}
                          onCommit={(width) => update(p.id, { width })}
                        />
                        <span className="unit">px</span>
                      </span>
                    </label>
                  </td>
                  <td className="preset-table__times" aria-hidden="true">
                    ×
                  </td>
                  <td>
                    <label className="preset-field">
                      <span>高さ</span>
                      <span className="dim-input">
                        <DimensionInput
                          value={p.height}
                          disabled={disabled}
                          onCommit={(height) => update(p.id, { height })}
                        />
                        <span className="unit">px</span>
                      </span>
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
                {showDerived && (
                  <tr className="preset-derived">
                    <td colSpan={5}>
                      <dl className="derived">
                        <div>
                          <dt>余白</dt>
                          <dd>{px.margin}</dd>
                        </div>
                        <div>
                          <dt>最大枠</dt>
                          <dd>{px.maxBox}</dd>
                        </div>
                        <div>
                          <dt>目標</dt>
                          <dd>{px.target}px四方</dd>
                        </div>
                        <div>
                          <dt>最小</dt>
                          <dd>{px.min}px四方</dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          </tbody>
        </table>
      </div>
      <div className="panel__foot">
        <button
          className="btn btn--sm"
          onClick={add}
          disabled={disabled || atPresetLimit}
          title={atPresetLimit ? `プリセットは最大${MAX_PRESETS}個までです` : undefined}
        >
          + プリセットを追加
        </button>
      </div>
    </div>
  );
}
