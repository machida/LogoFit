import { describe, expect, it } from 'vitest';
import { MAX_OUTPUT_PIXELS, MAX_OUTPUT_SIDE, isValidPreset, normalizePreset } from './preset';

describe('normalizePreset', () => {
  it('rounds dimensions and clamps the maximum side', () => {
    expect(normalizePreset({ id: 'p', prefix: '', width: 999999, height: 100.7 })).toEqual({
      id: 'p',
      prefix: '',
      width: MAX_OUTPUT_SIDE,
      height: 101,
    });
  });

  it('limits the total pixel count', () => {
    const preset = normalizePreset({ id: 'p', prefix: '', width: 4096, height: 4096 });
    expect(preset.width * preset.height).toBeLessThanOrEqual(MAX_OUTPUT_PIXELS);
    expect(isValidPreset(preset)).toBe(true);
  });
});
