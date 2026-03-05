import { useState, useCallback } from 'react';
import { EditorState, Segment, ProductClip, TrimRange, DEFAULT_SEGMENTS } from '@/types/editor';

const initialState: EditorState = {
  voiceover: null,
  voiceoverUrl: null,
  voiceoverDuration: 0,
  productClips: [null, null, null, null, null, null, null],
  segments: [],
  isProcessing: false,
  progress: 0,
  outputUrl: null,
};

export function useEditorState() {
  const [state, setState] = useState<EditorState>(initialState);

  const setVoiceover = useCallback((file: File, url: string, duration: number) => {
    const segmentDuration = duration / 7;
    const segments: Segment[] = DEFAULT_SEGMENTS.map((seg, i) => ({
      ...seg,
      startTime: i * segmentDuration,
      endTime: (i + 1) * segmentDuration,
    }));

    setState(prev => ({
      ...prev,
      voiceover: file,
      voiceoverUrl: url,
      voiceoverDuration: duration,
      segments,
      outputUrl: null,
    }));
  }, []);

  const setProductClip = useCallback((index: number, clip: ProductClip | null) => {
    setState(prev => {
      const clips = [...prev.productClips];
      clips[index] = clip;
      return { ...prev, productClips: clips, outputUrl: null };
    });
  }, []);

  const updateClipTrimRanges = useCallback((index: number, trimRanges: TrimRange[]) => {
    setState(prev => {
      const clips = [...prev.productClips];
      const clip = clips[index];
      if (!clip) return prev;
      clips[index] = { ...clip, trimRanges };
      return { ...prev, productClips: clips, outputUrl: null };
    });
  }, []);

  const updateSegment = useCallback((id: string, updates: Partial<Segment>) => {
    setState(prev => ({
      ...prev,
      segments: prev.segments.map(s => s.id === id ? { ...s, ...updates } : s),
      outputUrl: null,
    }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean, progress = 0) => {
    setState(prev => ({ ...prev, isProcessing, progress }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({ ...prev, progress }));
  }, []);

  const setOutputUrl = useCallback((outputUrl: string | null) => {
    setState(prev => ({ ...prev, outputUrl, isProcessing: false, progress: 100 }));
  }, []);

  const reset = useCallback(() => {
    if (state.voiceoverUrl) URL.revokeObjectURL(state.voiceoverUrl);
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    state.productClips.forEach(c => c && URL.revokeObjectURL(c.url));
    setState(initialState);
  }, [state]);

  return {
    state,
    setVoiceover,
    setProductClip,
    updateClipTrimRanges,
    updateSegment,
    setProcessing,
    setProgress,
    setOutputUrl,
    reset,
  };
}
