import type { Margins } from './types';

export function innerBox(width: number, height: number, margins: Margins) {
  const x = margins.horizontal * width;
  const y = margins.vertical * height;
  return {
    x,
    y,
    width: Math.max(0, width - 2 * x),
    height: Math.max(0, height - 2 * y),
  };
}

export function hasMargin(margins: Margins) {
  return margins.vertical > 0 || margins.horizontal > 0;
}
