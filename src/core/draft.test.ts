// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { validateDraft } from './draft';
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
});
