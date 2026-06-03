import { describe, expect, it } from 'vitest';
import { outputFileName } from './compose';
import type { LogoItem } from './types';

const withBase = (baseName: string) => ({ baseName }) as LogoItem;

describe('outputFileName', () => {
  it('replaces path separators and strips leading ../ (traversal-safe)', () => {
    expect(
      outputFileName({ id: 'p', prefix: '../ruby\\', width: 600, height: 600 }, withBase('../brand\\mark')),
    ).toBe('_ruby__brand_mark.png');
  });

  it('replaces Windows-illegal characters with underscore', () => {
    expect(
      outputFileName({ id: 'p', prefix: '', width: 1, height: 1 }, withBase('a:b*c?"<>|')),
    ).toBe('a_b_c_____.png');
  });

  it('trims trailing dots and spaces', () => {
    expect(
      outputFileName({ id: 'p', prefix: '', width: 1, height: 1 }, withBase('logo.  ')),
    ).toBe('logo.png');
  });

  it('falls back to "logo" when the base becomes empty', () => {
    expect(outputFileName({ id: 'p', prefix: '', width: 1, height: 1 }, withBase('...'))).toBe(
      'logo.png',
    );
  });

  it('keeps a normal prefix + base intact', () => {
    expect(
      outputFileName({ id: 'p', prefix: 'ruby_', width: 1, height: 1 }, withBase('cookpad2')),
    ).toBe('ruby_cookpad2.png');
  });

  it('caps very long names', () => {
    const name = outputFileName(
      { id: 'p', prefix: '', width: 1, height: 1 },
      withBase('a'.repeat(500)),
    );
    expect(name.length).toBeLessThanOrEqual('.png'.length + 120);
  });
});
