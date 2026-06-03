// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { validateDraft } from './draft';
import { MAX_FILES, MAX_FILE_BYTES, MAX_PRESETS } from './limits';
import { DEFAULT_SETTINGS } from './types';

function draft() {
  return {
    version: 1,
    settings: DEFAULT_SETTINGS,
    presets: [{ id: 'p', prefix: 'ruby_', width: 600, height: 600 }],
    items: [
      {
        id: 'logo',
        fileName: 'logo.svg',
        baseName: 'logo',
        areaOverride: null,
        originalFile: new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }),
      },
    ],
    previewPresetId: 'p',
    viewMode: 'cards',
    previewWhiteBackground: false,
  };
}

describe('validateDraft', () => {
  it('accepts a valid versioned draft', () => {
    expect(validateDraft(draft()).version).toBe(1);
  });

  it('rejects unsupported versions and unsafe presets', () => {
    expect(() => validateDraft({ ...draft(), version: 2 })).toThrow();
    expect(() =>
      validateDraft({ ...draft(), presets: [{ id: 'p', prefix: '', width: 999999, height: 600 }] }),
    ).toThrow();
  });

  it('rejects drafts that exceed resource limits (count / presets / file size)', () => {
    const base = draft();
    const item = base.items[0]!;

    const tooManyItems = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ ...item, id: `i${i}` }));
    expect(() => validateDraft({ ...base, items: tooManyItems })).toThrow();

    const tooManyPresets = Array.from({ length: MAX_PRESETS + 1 }, (_, i) => ({
      id: `p${i}`,
      prefix: '',
      width: 10,
      height: 10,
    }));
    expect(() =>
      validateDraft({ ...base, presets: tooManyPresets, previewPresetId: 'p0' }),
    ).toThrow();

    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 });
    expect(() => validateDraft({ ...base, items: [{ ...item, originalFile: big }] })).toThrow();
  });
});
