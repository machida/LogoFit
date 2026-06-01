export interface SanitizedSvg {
  /** サニタイズ済みの安全な SVG 文字列 */
  svg: string;
  /** ラスタライズ時の基準となる固有サイズ（px）。比率の決定に使う */
  width: number;
  height: number;
}

const REMOVE_TAGS = new Set(['script', 'style', 'foreignobject', 'iframe', 'audio', 'video']);
const SAFE_HREF = /^(#|data:image\/)/i;
const URL_REFERENCE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

function isExternalHref(value: string): boolean {
  const v = value.trim();
  if (v === '') return false;
  // 内部参照(#...) と data:image のみ許可。それ以外(http, javascript, file, 相対URL)は除去
  return !SAFE_HREF.test(v);
}

function hasUnsafeUrlReference(value: string): boolean {
  for (const match of value.matchAll(URL_REFERENCE)) {
    if (!match[2].trim().startsWith('#')) return true;
  }
  return false;
}

/** viewBox / width / height から固有サイズを決定する */
function resolveDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const parseLen = (v: string | null): number | null => {
    if (!v) return null;
    // % や em など相対単位は無視して viewBox にフォールバックさせる
    if (/%|em|ex|vw|vh/i.test(v)) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  let width = parseLen(svg.getAttribute('width'));
  let height = parseLen(svg.getAttribute('height'));

  const viewBox = svg.getAttribute('viewBox');
  let vbW: number | null = null;
  let vbH: number | null = null;
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      vbW = parts[2] > 0 ? parts[2] : null;
      vbH = parts[3] > 0 ? parts[3] : null;
    }
  }

  // width/height が無ければ viewBox から、両方無ければ正方形フォールバック
  if (width == null && height == null) {
    width = vbW ?? 300;
    height = vbH ?? 150;
  } else if (width == null) {
    const aspect = vbW && vbH ? vbW / vbH : 1;
    width = height! * aspect;
  } else if (height == null) {
    const aspect = vbW && vbH ? vbH / vbW : 1;
    height = width * aspect;
  }

  return { width: width!, height: height! };
}

/**
 * SVG 文字列を DOM へ直接挿入せず、DOMParser で解析して危険要素を除去する。
 * - script 等の実行可能タグを除去
 * - on* イベントハンドラ属性を除去
 * - style 要素を除去
 * - href と url(...) 属性値から外部参照を除去
 * 解析できない場合は例外を投げる。
 */
export function sanitizeSvg(svgText: string): SanitizedSvg {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('SVG の解析に失敗しました（不正な形式）');
  }

  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg') {
    throw new Error('ルート要素が <svg> ではありません');
  }

  const walk = (el: Element) => {
    // 子から先に処理（削除中に列挙が崩れないよう配列化）
    for (const child of Array.from(el.children)) {
      if (REMOVE_TAGS.has(child.localName.toLowerCase())) {
        child.remove();
        continue;
      }
      walk(child);
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const local = attr.localName.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((local === 'href' || name === 'xlink:href') && isExternalHref(attr.value)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (hasUnsafeUrlReference(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  };

  walk(root as Element);

  const { width, height } = resolveDimensions(root as unknown as SVGSVGElement);
  const svg = new XMLSerializer().serializeToString(root);

  return { svg, width, height };
}
