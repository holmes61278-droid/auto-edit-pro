export interface Segment {
  id: string;
  label: string;
  type: 'hook' | 'product' | 'cta';
  productIndex?: number; // 0-4 for products
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface TrimRange {
  start: number;
  end: number;
  sourceIndex?: number; // for hook/cta: which product video (0-4) this range comes from
}

export interface ProductClip {
  id: string;
  file: File;
  url: string;
  duration: number;
  index: number; // 0-6 (hook=0, products=1-5, cta=6)
  thumbnail?: string;
  trimRanges: TrimRange[]; // multiple selected ranges
}

export interface EditorState {
  voiceover: File | null;
  voiceoverUrl: string | null;
  voiceoverDuration: number;
  productClips: (ProductClip | null)[];
  segments: Segment[];
  isProcessing: boolean;
  progress: number;
  outputUrl: string | null;
}

export const CLIP_LABELS = ['Hook', 'Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5', 'CTA'];

export const DEFAULT_SEGMENTS: Omit<Segment, 'startTime' | 'endTime'>[] = [
  { id: 'hook', label: 'Hook', type: 'hook' },
  { id: 'product-1', label: 'Product 1', type: 'product', productIndex: 0 },
  { id: 'product-2', label: 'Product 2', type: 'product', productIndex: 1 },
  { id: 'product-3', label: 'Product 3', type: 'product', productIndex: 2 },
  { id: 'product-4', label: 'Product 4', type: 'product', productIndex: 3 },
  { id: 'product-5', label: 'Product 5', type: 'product', productIndex: 4 },
  { id: 'cta', label: 'CTA', type: 'cta' },
];
