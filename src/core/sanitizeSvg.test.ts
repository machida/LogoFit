// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './sanitizeSvg';

describe('sanitizeSvg', () => {
  it('removes executable content and every external URL reference', () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <style>@import url("https://example.com/a.css");</style>
        <script>alert(1)</script>
        <defs><linearGradient id="safe"/></defs>
        <rect onload="alert(1)" fill="url(https://example.com/fill.svg)" stroke="url(#safe)"/>
        <image href="../track.png"/>
      </svg>
    `);

    expect(result.svg).not.toContain('<style');
    expect(result.svg).not.toContain('<script');
    expect(result.svg).not.toContain('onload');
    expect(result.svg).not.toContain('https://');
    expect(result.svg).not.toContain('../track.png');
    expect(result.svg).toContain('stroke="url(#safe)"');
  });

  it('drops data:image/svg+xml hrefs (nested SVG) but keeps raster data URLs', () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <image id="nested" href="data:image/svg+xml;base64,PHN2Zy8+"/>
        <image id="raster" href="data:image/png;base64,iVBORw0KGgo="/>
      </svg>
    `);

    expect(result.svg).not.toContain('image/svg+xml');
    expect(result.svg).toContain('data:image/png;base64');
  });
});
