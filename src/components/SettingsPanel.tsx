import type { BackgroundType, GlobalSettings, Margins } from '../core/types';

interface Props {
  settings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
  disabled?: boolean;
}

function PercentSlider({
  label,
  value,
  min,
  max,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        <strong>{Math.round(value * 100)}%</strong>
      </span>
      <input
        type="range"
        min={Math.round(min * 100)}
        max={Math.round(max * 100)}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function SettingsPanel({ settings, onChange, disabled = false }: Props) {
  const set = (patch: Partial<GlobalSettings>) => onChange({ ...settings, ...patch });
  const setMargin = (side: keyof Margins, value: number) => {
    const margins = settings.syncMargins
      ? { vertical: value, horizontal: value }
      : { ...settings.margins, [side]: value };
    set({ margins });
  };
  const setSyncMargins = (syncMargins: boolean) =>
    set({
      syncMargins,
      margins: syncMargins
        ? { vertical: settings.margins.vertical, horizontal: settings.margins.vertical }
        : settings.margins,
    });

  return (
    <div className="panel">
      <div className="panel__head">
        <h3>補正設定</h3>
      </div>
      <PercentSlider
        label="目標ロゴ面積率"
        value={settings.targetAreaRatio}
        min={0.05}
        max={1}
        disabled={disabled}
        onChange={(v) => set({ targetAreaRatio: v, minAreaRatio: Math.min(settings.minAreaRatio, v) })}
        hint="余白の内側に対するロゴ塗りの割合（揃えたい狙い）"
      />
      <PercentSlider
        label="最小面積率"
        value={settings.minAreaRatio}
        min={0}
        max={Math.max(0.02, settings.targetAreaRatio)}
        disabled={disabled}
        onChange={(v) => set({ minAreaRatio: v })}
        hint="内側面積に対する塗りの下限。細長いロゴの底上げ"
      />
      <div className="field">
        <span className="field__label">
          余白
          <label className="margin-sync">
            <input
              type="checkbox"
              checked={settings.syncMargins}
              disabled={disabled}
              onChange={(e) => setSyncMargins(e.target.checked)}
            />
            縦横を同じにする
          </label>
        </span>
        <div className="margin-grid">
          {([
            ['vertical', '上下'],
            ['horizontal', '左右'],
          ] as const).map(([side, label]) => (
            <label className="margin-field" key={side}>
              <span>
                {label}
                <strong>{Math.round(settings.margins[side] * 100)}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={40}
                value={Math.round(settings.margins[side] * 100)}
                disabled={disabled}
                onChange={(e) => setMargin(side, Number(e.target.value) / 100)}
              />
            </label>
          ))}
        </div>
        <span className="field__hint">枠端からの余白。ロゴはこの内側まで拡大（＝最大）</span>
      </div>
      <fieldset className="field">
        <legend className="field__label">背景</legend>
        <div className="seg seg--equal">
          {(['transparent', 'white'] as BackgroundType[]).map((bg) => (
            <button
              key={bg}
              type="button"
              className={`seg__btn${settings.background === bg ? ' seg__btn--active' : ''}`}
              onClick={() => set({ background: bg })}
              aria-pressed={settings.background === bg}
              disabled={disabled}
            >
              {bg === 'transparent' ? '透明' : '白'}
            </button>
          ))}
        </div>
        <span className="field__hint">書き出す画像に適用されます</span>
      </fieldset>
    </div>
  );
}
