export type BackgroundType = 'transparent' | 'white';

export interface OutputPreset {
  id: string;
  prefix: string;
  width: number;
  height: number;
}

/**
 * すべて 0..1 の割合で保持する。
 * - targetAreaRatio: キャンバス面積に対する目標ロゴ面積率（揃えたい狙い）
 * - minAreaRatio: ロゴ塗り面積の下限（細長いロゴが小さくなりすぎない floor）
 * - margins: キャンバス端からの余白（上下 / 左右）。ロゴはこの内側まで拡大できる = 実質の最大
 * - syncMargins: true のとき上下 / 左右余白を同じ値で操作する
 * - background: 出力背景
 */
export interface GlobalSettings {
  targetAreaRatio: number;
  minAreaRatio: number;
  margins: Margins;
  syncMargins: boolean;
  background: BackgroundType;
}

export interface Margins {
  vertical: number;
  horizontal: number;
}

export interface TrimBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LogoAnalysis {
  /** ラスタライズ元キャンバスのサイズ（px） */
  sourceWidth: number;
  sourceHeight: number;
  /** 透明余白を除いた実描画範囲（元キャンバス座標, px） */
  trim: TrimBox;
  /** トリム領域内の alpha 加重インク面積（px 相当） */
  inkArea: number;
  /** 透明ピクセルが無く全面不透明とみなせる（＝背景付き画像の可能性） */
  opaque: boolean;
}

export type LogoStatus = 'loading' | 'ready' | 'error';

export interface LogoItem {
  id: string;
  fileName: string;
  /** 拡張子を除いたベース名（出力ファイル名に使用） */
  baseName: string;
  kind: 'svg' | 'png' | 'pdf' | 'ai';
  /** 再読み込み時の復旧用。IndexedDB に保存するアップロード元ファイル */
  originalFile: File;
  /** ラスタライズ済みのソース。解析・合成の両方で使う */
  source: HTMLCanvasElement | null;
  analysis: LogoAnalysis | null;
  /** このロゴ個別の目標面積率。null のとき全体設定の targetAreaRatio に追従 */
  areaOverride: number | null;
  status: LogoStatus;
  error?: string;
  /** 致命的でない注意喚起（例: 不透明背景の可能性）。表示のみで書き出しは可能 */
  warning?: string;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  // 面積率は「余白の内側（使える領域）」に対する割合
  targetAreaRatio: 0.25,
  minAreaRatio: 0.18,
  margins: { vertical: 0.1, horizontal: 0.1 },
  syncMargins: true,
  background: 'transparent',
};

// RubyKaigi スポンサー画像の @2x アセット実寸に合わせた正方形プリセット
export const DEFAULT_PRESETS: OutputPreset[] = [
  { id: 'p-ruby', prefix: 'ruby_', width: 600, height: 600 },
  { id: 'p-plat', prefix: 'plat_', width: 500, height: 500 },
  { id: 'p-gold', prefix: 'gold_', width: 400, height: 400 },
  { id: 'p-silver', prefix: 'silver_', width: 320, height: 320 },
];
