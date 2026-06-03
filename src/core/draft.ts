import type { GlobalSettings, LogoItem, OutputPreset } from './types';
import { isValidPreset } from './preset';
import { createCoalescingQueue } from './writeQueue';

const DB_NAME = 'logofit';
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'current';
const DB_VERSION = 1;
const DRAFT_VERSION = 1;

export interface DraftItem {
  id: string;
  fileName: string;
  baseName: string;
  areaOverride: number | null;
  originalFile: File;
}

export interface Draft {
  version: number;
  settings: GlobalSettings;
  presets: OutputPreset[];
  items: DraftItem[];
  previewPresetId: string;
  viewMode: 'cards' | 'board';
  previewWhiteBackground: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

function isRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isSettings(value: unknown): value is GlobalSettings {
  if (!isRecord(value) || !isRecord(value.margins)) return false;
  return (
    isRatio(value.targetAreaRatio) &&
    isRatio(value.minAreaRatio) &&
    value.minAreaRatio <= value.targetAreaRatio &&
    isRatio(value.margins.vertical) &&
    isRatio(value.margins.horizontal) &&
    typeof value.syncMargins === 'boolean' &&
    (value.background === 'transparent' || value.background === 'white')
  );
}

function isDraftItem(value: unknown): value is DraftItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.fileName === 'string' &&
    typeof value.baseName === 'string' &&
    (value.areaOverride == null || isRatio(value.areaOverride)) &&
    value.originalFile instanceof File
  );
}

export function validateDraft(value: unknown): Draft {
  if (!isRecord(value) || value.version !== DRAFT_VERSION) {
    throw new Error('下書きのバージョンが対応していません');
  }
  if (
    !isSettings(value.settings) ||
    !Array.isArray(value.presets) ||
    value.presets.length === 0 ||
    !value.presets.every((preset) => isRecord(preset) && isValidPreset(preset as unknown as OutputPreset)) ||
    !Array.isArray(value.items) ||
    !value.items.every(isDraftItem) ||
    typeof value.previewPresetId !== 'string' ||
    !value.presets.some((preset) => preset.id === value.previewPresetId) ||
    (value.viewMode !== 'cards' && value.viewMode !== 'board') ||
    typeof value.previewWhiteBackground !== 'boolean'
  ) {
    throw new Error('下書きの内容が不正です');
  }
  return value as unknown as Draft;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function loadDraft(): Promise<Draft | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DRAFT_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // validateDraft の例外をハンドラ内で握りつぶすと Promise が pending のまま固まり、
        // 呼び出し側の hydration が止まる。必ず resolve / reject のどちらかへ落とす。
        try {
          resolve(request.result == null ? null : validateDraft(request.result));
        } catch (err) {
          reject(err);
        }
      };
    });
  } finally {
    db.close();
  }
}

export async function saveDraft(draft: Draft): Promise<void> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(draft, DRAFT_KEY);
    await complete(transaction);
  } finally {
    db.close();
  }
}

export async function clearDraft(): Promise<void> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(DRAFT_KEY);
    await complete(transaction);
  } finally {
    db.close();
  }
}

// ---- 書き込みの直列化 ----
// 保存・削除を単一キューで順番に実行し、常に「最新の要求」だけを書き込む。
// 直接 saveDraft/clearDraft を並行で呼ぶと、重い書き込みが後勝ちして古い状態が残り得る。
type DraftOp = { kind: 'save'; draft: Draft } | { kind: 'clear' };

const enqueueDraftOp = createCoalescingQueue<DraftOp>((op) =>
  op.kind === 'save' ? saveDraft(op.draft) : clearDraft(),
);

/** 最新スナップショットの保存を直列キューへ積む */
export function queueSaveDraft(draft: Draft): Promise<void> {
  return enqueueDraftOp({ kind: 'save', draft });
}

/** 下書き削除を直列キューへ積む（保存中なら順番に実行される） */
export function queueClearDraft(): Promise<void> {
  return enqueueDraftOp({ kind: 'clear' });
}

export function draftItems(items: LogoItem[]): DraftItem[] {
  return items.map(({ id, fileName, baseName, areaOverride, originalFile }) => ({
    id,
    fileName,
    baseName,
    areaOverride,
    originalFile,
  }));
}
