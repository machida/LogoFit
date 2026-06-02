import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { BoardView } from './components/BoardView';
import { LogoPreview } from './components/LogoPreview';
import { PresetTable } from './components/PresetTable';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsPreview } from './components/SettingsPreview';
import { Uploader } from './components/Uploader';
import { clearDraft, draftItems, loadDraft, saveDraft } from './core/draft';
import { loadLogo } from './core/loadLogo';
import { DEFAULT_PRESETS, DEFAULT_SETTINGS } from './core/types';
import type { GlobalSettings, LogoItem, OutputPreset } from './core/types';
import { downloadBlob, generateZip } from './core/zip';

export default function App() {
  const [items, setItems] = useState<LogoItem[]>([]);
  const [presets, setPresets] = useState<OutputPreset[]>(DEFAULT_PRESETS);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [previewPresetId, setPreviewPresetId] = useState<string>(DEFAULT_PRESETS[0].id);
  const [viewMode, setViewMode] = useState<'cards' | 'board'>('cards');
  const [previewWhiteBackground, setPreviewWhiteBackground] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [analyzing, setAnalyzing] = useState<{ done: number; total: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [draftStatus, setDraftStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [restoreWarning, setRestoreWarning] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [draftSaveEnabled, setDraftSaveEnabled] = useState(true);
  const saveSequence = useRef(0);

  const previewPreset = useMemo(
    () => presets.find((p) => p.id === previewPresetId) ?? presets[0],
    [presets, previewPresetId],
  );

  const readyCount = items.filter((it) => it.status === 'ready').length;
  const canGenerate = readyCount > 0 && presets.length > 0 && !generating && !analyzing;

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const draft = await loadDraft();
        if (!draft || cancelled) return;
        setSettings(draft.settings);
        setPresets(draft.presets);
        setPreviewPresetId(draft.previewPresetId);
        setViewMode(draft.viewMode);
        setPreviewWhiteBackground(draft.previewWhiteBackground);
        if (draft.items.length > 0) {
          setAnalyzing({ done: 0, total: draft.items.length });
          const restored = await Promise.all(
            draft.items.map(async (saved) => {
              const loaded = await loadLogo(saved.originalFile);
              if (!cancelled) {
                setAnalyzing((current) =>
                  current ? { ...current, done: current.done + 1 } : current,
                );
              }
              return {
                ...loaded,
                id: saved.id,
                fileName: saved.fileName,
                baseName: saved.baseName,
                areaOverride: saved.areaOverride,
              };
            }),
          );
          if (!cancelled) setItems(restored);
        }
      } catch (err) {
        console.error('下書きの復旧に失敗しました', err);
        setDraftStatus('error');
        setDraftSaveEnabled(false);
        setRestoreWarning(
          '保存済みの作業内容を復旧できませんでした。既存の下書きを保護するため、自動保存を停止しています。編集すると現在の内容で保存を再開します。',
        );
      } finally {
        if (!cancelled) {
          setAnalyzing(null);
          setHydrated(true);
          setDraftStatus((current) => (current === 'error' ? current : 'saved'));
        }
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !draftSaveEnabled || analyzing) return;
    const sequence = saveSequence.current + 1;
    saveSequence.current = sequence;
    const timer = window.setTimeout(() => {
      setDraftStatus('saving');
      void saveDraft({
        version: 1,
        settings,
        presets,
        items: draftItems(items),
        previewPresetId,
        viewMode,
        previewWhiteBackground,
      })
        .then(() => {
          if (saveSequence.current === sequence) {
            setDraftStatus('saved');
            setSaveWarning(null);
            setRestoreWarning(null);
          }
        })
        .catch((err) => {
          console.error('下書きの保存に失敗しました', err);
          if (saveSequence.current === sequence) {
            setDraftStatus('error');
            setSaveWarning(
              '下書きを保存できませんでした。ブラウザの保存容量を確認し、不要なロゴを削除してから再度編集してください。',
            );
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [analyzing, draftSaveEnabled, hydrated, items, presets, previewPresetId, previewWhiteBackground, settings, viewMode]);

  const resumeDraftSaving = () => setDraftSaveEnabled(true);

  const handleFiles = async (files: File[]) => {
    resumeDraftSaving();
    setAnalyzing({ done: 0, total: files.length });
    const loaded = await Promise.all(
      files.map(async (file) => {
        const item = await loadLogo(file);
        setAnalyzing((current) =>
          current ? { ...current, done: current.done + 1 } : current,
        );
        return item;
      }),
    );
    setItems((prev) => [...prev, ...loaded]);
    setAnalyzing(null);
  };

  const updateItem = (id: string, patch: Partial<LogoItem>) => {
    resumeDraftSaving();
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const updateBaseName = (id: string, baseName: string) => {
    resumeDraftSaving();
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, baseName, fileName: `${baseName}.${it.kind}` } : it,
      ),
    );
  };
  const removeItem = (id: string) => {
    resumeDraftSaving();
    setItems((prev) => prev.filter((it) => it.id !== id));
  };
  const clearAll = () => {
    if (!window.confirm('アップロード済みのロゴと個別調整をすべて削除しますか？')) return;
    resumeDraftSaving();
    setItems([]);
    void clearDraft().catch((err) => {
      console.error('下書きの削除に失敗しました', err);
      setDraftStatus('error');
      setSaveWarning('下書きを削除できませんでした。ブラウザの保存領域を確認してください。');
    });
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setProgress({ done: 0, total: readyCount * presets.length });
    try {
      const blob = await generateZip(items, presets, settings, setProgress);
      downloadBlob(blob, 'logos.zip');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ZIP 生成に失敗しました');
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>
            Logo<span>Fit</span>
          </h1>
          <p>ロゴの見た目の大きさを揃えて、指定サイズで一括書き出し</p>
        </div>
        <span className={`draft-status draft-status--${draftStatus}`} aria-live="polite">
          {draftStatus === 'loading' && '下書きを確認中'}
          {draftStatus === 'saving' && '下書きを保存中'}
          {draftStatus === 'saved' && '下書き保存済み'}
          {draftStatus === 'error' && '下書き保存失敗'}
        </span>
      </header>

      <div className="app__layout">
        {restoreWarning && (
          <div className="warning-banner" role="alert">
            {restoreWarning}
          </div>
        )}
        {saveWarning && (
          <div className="warning-banner" role="alert">
            {saveWarning}
          </div>
        )}
        <section className="section">
          <h2 className="section__title">アップロード</h2>
          <Uploader onFiles={handleFiles} disabled={!hydrated || analyzing != null || generating} />
          {analyzing && (
            <p className="analysis-progress" aria-live="polite">
              {analyzing.total}件を解析中 {analyzing.done}/{analyzing.total}
            </p>
          )}
        </section>

        <section className="section" id="settings">
          <div className="section__title-row">
            <h2 className="section__title">設定</h2>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              aria-expanded={settingsExpanded}
              aria-controls="settings-controls"
              onClick={() => setSettingsExpanded((expanded) => !expanded)}
            >
              {settingsExpanded ? '設定を閉じる' : '設定を開く'}
            </button>
          </div>
          {settingsExpanded && (
            <div className="controls" id="settings-controls">
              <PresetTable
                presets={presets}
                settings={settings}
                onChange={(next) => {
                  resumeDraftSaving();
                  setPresets(next);
                  // プレビュー対象が削除されたら有効な ID へ寄せる。
                  // 無効な previewPresetId を保存すると次回起動時に下書き検証で弾かれる。
                  if (next.length > 0 && !next.some((p) => p.id === previewPresetId)) {
                    setPreviewPresetId(next[0].id);
                  }
                }}
                disabled={generating}
              />
              <SettingsPanel
                settings={settings}
                onChange={(next) => {
                  resumeDraftSaving();
                  setSettings(next);
                }}
                disabled={generating}
              />
              <SettingsPreview settings={settings} previewPreset={previewPreset} />
            </div>
          )}
        </section>

        <main className="section app__main">
          <h2 className="section__title">プレビュー</h2>
          <div className="main__bar">
            <div className="main__bar-left">
              <strong>{readyCount}</strong> 件のロゴ
              {items.length > readyCount && (
                <span className="muted"> / {items.length - readyCount} 件エラー</span>
              )}
              <a className="settings-link" href="#settings" onClick={() => setSettingsExpanded(true)}>
                設定へ戻る
              </a>
            </div>
            <div className="main__bar-right">
              <div className="seg">
                <button
                  className={`seg__btn${viewMode === 'cards' ? ' seg__btn--active' : ''}`}
                  onClick={() => {
                    resumeDraftSaving();
                    setViewMode('cards');
                  }}
                  aria-pressed={viewMode === 'cards'}
                >
                  カード
                </button>
                <button
                  className={`seg__btn${viewMode === 'board' ? ' seg__btn--active' : ''}`}
                  onClick={() => {
                    resumeDraftSaving();
                    setViewMode('board');
                  }}
                  aria-pressed={viewMode === 'board'}
                >
                  並べて
                </button>
              </div>
              <label className="preview-select">
                プレビュー対象
                <select
                  value={previewPreset?.id}
                  onChange={(e) => {
                    resumeDraftSaving();
                    setPreviewPresetId(e.target.value);
                  }}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prefix} ({p.width}×{p.height})
                    </option>
                  ))}
                </select>
              </label>
              <label className="preview-white">
                <input
                  type="checkbox"
                  checked={previewWhiteBackground}
                  onChange={(e) => {
                    resumeDraftSaving();
                    setPreviewWhiteBackground(e.target.checked);
                  }}
                />
                <span>
                  白背景で確認
                  <small>プレビューのみ</small>
                </span>
              </label>
              {items.length > 0 && (
                <button className="btn btn--ghost btn--danger main__clear" onClick={clearAll} disabled={generating}>
                  全消去
                </button>
              )}
              {items.length > 0 && (
                <button className="btn btn--primary" onClick={handleGenerate} disabled={!canGenerate}>
                  {generating
                    ? progress
                      ? `生成中 ${progress.done}/${progress.total}`
                      : '生成中…'
                    : `ZIP生成（${readyCount * presets.length} 枚）`}
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty">
              <p>まだロゴがありません。上のエリアに SVG / PNG をドロップしてください。</p>
            </div>
          ) : viewMode === 'board' ? (
            <BoardView
              items={items}
              previewPreset={previewPreset}
              settings={settings}
              previewWhiteBackground={previewWhiteBackground}
            />
          ) : (
            <div className="logo-grid">
              {items.map((it) => (
                <LogoPreview
                  key={it.id}
                  item={it}
                  previewPreset={previewPreset}
                  settings={settings}
                  previewWhiteBackground={previewWhiteBackground}
                  disabled={generating}
                  onBaseNameChange={(baseName) => updateBaseName(it.id, baseName)}
                  onAreaChange={(ratio) => updateItem(it.id, { areaOverride: ratio })}
                  onRemove={() => removeItem(it.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
