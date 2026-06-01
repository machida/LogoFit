import { describe, expect, it } from 'vitest';
import { computePlacement } from './fit';
import { DEFAULT_SETTINGS } from './types';

describe('computePlacement', () => {
  it('centers the logo inside the available margin box', () => {
    const placement = computePlacement(
      {
        sourceWidth: 100,
        sourceHeight: 100,
        trim: { x: 0, y: 0, width: 100, height: 100 },
        inkArea: 10000,
      },
      { id: 'p', prefix: '', width: 600, height: 600 },
      DEFAULT_SETTINGS,
      null,
    );

    expect(placement).not.toBeNull();
    expect(placement?.achievedAreaRatio).toBeCloseTo(0.25);
    expect(placement?.dx).toBeCloseTo(180);
    expect(placement?.dy).toBeCloseTo(180);
  });
});
