export interface Segment {
  id: string;
  label: string;
  type: 'hook' | 'product' | 'cta';
  productIndex?: number; // 0-4 for products
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface ProductClip {
  id: string;
  file: File;
  url: string;
  duration: number;
  index: number; // 0-4
  thumbnail?: string;
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

export const DEFAULT_SEGMENTS: Omit<Segment, 'startTime' | 'endTime'>[] = [
  { id: 'hook', label: 'Hook', type: 'hook' },
  { id: 'product-1', label: 'Product 1', type: 'product', productIndex: 0 },
  { id: 'product-2', label: 'Product 2', type: 'product', productIndex: 1 },
  { id: 'product-3', label: 'Product 3', type: 'product', productIndex: 2 },
  { id: 'product-4', label: 'Product 4', type: 'product', productIndex: 3 },
  { id: 'product-5', label: 'Product 5', type: 'product', productIndex: 4 },
  { id: 'cta', label: 'CTA', type: 'cta' },
];
