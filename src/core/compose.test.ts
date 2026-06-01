import { describe, expect, it } from 'vitest';
import { outputFileName } from './compose';
import type { LogoItem } from './types';

const item = { baseName: '../brand\\mark' } as LogoItem;

describe('outputFileName', () => {
  it('removes path separators from prefix and base name', () => {
    expect(outputFileName({ id: 'p', prefix: '../ruby\\', width: 600, height: 600 }, item)).toBe(
      '.._ruby_.._brand_mark.png',
    );
  });
});
