import type { OutputPreset } from './types';

export const MAX_OUTPUT_SIDE = 4096;
export const MAX_OUTPUT_PIXELS = 16_000_000;

export function normalizeDimension(value: number): number {
  return Math.max(1, Math.min(MAX_OUTPUT_SIDE, Math.round(value) || 1));
}

export function normalizePreset(preset: OutputPreset): OutputPreset {
  let width = normalizeDimension(preset.width);
  let height = normalizeDimension(preset.height);

  if (width * height > MAX_OUTPUT_PIXELS) {
    const scale = Math.sqrt(MAX_OUTPUT_PIXELS / (width * height));
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }

  return { ...preset, width, height };
}

export function isValidPreset(preset: OutputPreset): boolean {
  return (
    typeof preset.id === 'string' &&
    typeof preset.prefix === 'string' &&
    Number.isInteger(preset.width) &&
    Number.isInteger(preset.height) &&
    preset.width >= 1 &&
    preset.height >= 1 &&
    preset.width <= MAX_OUTPUT_SIDE &&
    preset.height <= MAX_OUTPUT_SIDE &&
    preset.width * preset.height <= MAX_OUTPUT_PIXELS
  );
}
