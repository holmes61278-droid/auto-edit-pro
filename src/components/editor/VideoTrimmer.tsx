import { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Check, X, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { TrimRange } from '@/types/editor';

interface VideoSource {
  url: string;
  duration: number;
  label: string;
}

interface VideoTrimmerProps {
  videoUrl: string;
  videoDuration: number;
  initialRanges: TrimRange[];
  segmentDuration: number;
  label: string;
  onConfirm: (ranges: TrimRange[]) => void;
  onCancel: () => void;
  multiSource?: VideoSource[]; // for hook/cta: all product videos
}

export function VideoTrimmer({
  videoUrl,
  videoDuration,
  initialRanges,
  segmentDuration,
  label,
  onConfirm,
  onCancel,
  multiSource,
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Multi-source: track which source is active
  const isMulti = !!multiSource && multiSource.length > 0;
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);

  const currentSource = isMulti ? multiSource![activeSourceIndex] : { url: videoUrl, duration: videoDuration, label };
  const currentUrl = currentSource.url;
  const currentDuration = currentSource.duration;

  const [ranges, setRanges] = useState<TrimRange[]>(
    initialRanges.length > 0
      ? initialRanges
      : [{ start: 0, end: Math.min(currentDuration, segmentDuration || currentDuration), sourceIndex: isMulti ? 0 : undefined }]
  );
  const [dragging, setDragging] = useState<{ rangeIndex: number; edge: 'start' | 'end' } | null>(null);
  const [activeRange, setActiveRange] = useState(0);

  const totalSelected = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  const speedFactor = segmentDuration > 0 ? totalSelected / segmentDuration : 1;
  const speedLabel = speedFactor > 1.02 ? `${speedFactor.toFixed(2)}x faster` : speedFactor < 0.98 ? `${(1/speedFactor).toFixed(2)}x slower` : '1x';

  // Ranges for currently visible source
  const visibleRangeIndices = ranges.map((r, i) => i).filter(i => {
    if (!isMulti) return true;
    return ranges[i].sourceIndex === activeSourceIndex;
  });

  // Sync video time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setCurrentTime(video.currentTime);
    const ended = () => setIsPlaying(false);
    video.addEventListener('timeupdate', update);
    video.addEventListener('ended', ended);
    return () => {
      video.removeEventListener('timeupdate', update);
      video.removeEventListener('ended', ended);
    };
  }, []);

  // When switching sources, update video src
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.src = currentUrl;
    video.currentTime = 0;
    setCurrentTime(0);
  }, [currentUrl]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const timeToPercent = (t: number) => (t / currentDuration) * 100;

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current) return;
    const x = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(currentDuration, x * currentDuration));
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, [currentDuration, dragging]);

  const addRange = useCallback(() => {
    // Find largest gap in current source's ranges
    const sourceRanges = ranges.filter(r => !isMulti || r.sourceIndex === activeSourceIndex).sort((a, b) => a.start - b.start);
    let bestStart = 0, bestEnd = 0, bestLen = 0;

    if (sourceRanges.length === 0 || sourceRanges[0].start > 0) {
      const gapEnd = sourceRanges.length > 0 ? sourceRanges[0].start : currentDuration;
      if (gapEnd > bestLen) { bestStart = 0; bestEnd = gapEnd; bestLen = gapEnd; }
    }
    for (let i = 0; i < sourceRanges.length - 1; i++) {
      const gapLen = sourceRanges[i + 1].start - sourceRanges[i].end;
      if (gapLen > bestLen) { bestStart = sourceRanges[i].end; bestEnd = sourceRanges[i + 1].start; bestLen = gapLen; }
    }
    if (sourceRanges.length > 0) {
      const lastEnd = sourceRanges[sourceRanges.length - 1].end;
      const gapLen = currentDuration - lastEnd;
      if (gapLen > bestLen) { bestStart = lastEnd; bestEnd = currentDuration; bestLen = gapLen; }
    }

    if (bestLen < 0.5) return;

    const rangeSize = Math.min(bestLen, 2);
    const center = (bestStart + bestEnd) / 2;
    const newRange: TrimRange = {
      start: Math.max(bestStart, center - rangeSize / 2),
      end: Math.min(bestEnd, center + rangeSize / 2),
      sourceIndex: isMulti ? activeSourceIndex : undefined,
    };

    const newRanges = [...ranges, newRange];
    setRanges(newRanges);
    setActiveRange(newRanges.length - 1);
  }, [ranges, currentDuration, isMulti, activeSourceIndex]);

  const removeRange = useCallback((index: number) => {
    const newRanges = ranges.filter((_, i) => i !== index);
    setRanges(newRanges);
    setActiveRange(Math.min(activeRange, newRanges.length - 1));
  }, [ranges, activeRange]);

  // Drag handlers
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = x * currentDuration;
      const { rangeIndex, edge } = dragging;

      setRanges(prev => {
        const newRanges = [...prev];
        const range = { ...newRanges[rangeIndex] };

        // Get same-source ranges sorted
        const sameSource = newRanges
          .map((r, i) => ({ ...r, idx: i }))
          .filter(r => !isMulti || r.sourceIndex === range.sourceIndex)
          .sort((a, b) => a.start - b.start);
        const sortedIdx = sameSource.findIndex(r => r.idx === rangeIndex);

        if (edge === 'start') {
          const minStart = sortedIdx > 0 ? sameSource[sortedIdx - 1].end : 0;
          range.start = Math.max(minStart, Math.min(time, range.end - 0.3));
        } else {
          const maxEnd = sortedIdx < sameSource.length - 1 ? sameSource[sortedIdx + 1].start : currentDuration;
          range.end = Math.min(maxEnd, Math.max(time, range.start + 0.3));
        }

        newRanges[rangeIndex] = range;
        return newRanges;
      });
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, currentDuration, isMulti]);

  useEffect(() => {
    if (videoRef.current && !isPlaying && ranges[activeRange]) {
      const r = ranges[activeRange];
      // Switch source if needed
      if (isMulti && r.sourceIndex !== undefined && r.sourceIndex !== activeSourceIndex) {
        setActiveSourceIndex(r.sourceIndex);
      }
      videoRef.current.currentTime = r.start;
      setCurrentTime(r.start);
    }
  }, [activeRange]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-card border border-border p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono font-semibold text-foreground">
            Trim — {label}
          </h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source tabs for multi-source */}
        {isMulti && (
          <div className="flex gap-1 flex-wrap">
            {multiSource!.map((src, i) => {
              const count = ranges.filter(r => r.sourceIndex === i).length;
              return (
                <button
                  key={i}
                  onClick={() => setActiveSourceIndex(i)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-all border ${
                    i === activeSourceIndex
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-transparent hover:border-border'
                  }`}
                >
                  {src.label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        )}

        {/* Video preview */}
        <div className="relative rounded-lg overflow-hidden bg-background aspect-video">
          <video
            ref={videoRef}
            src={currentUrl}
            className="w-full h-full object-contain"
            playsInline
            muted
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-80"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>
          <span className="text-xs font-mono text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(currentDuration)}
          </span>
          <div className="flex-1" />
          <span className="text-xs font-mono text-muted-foreground">
            Selected: <span className={totalSelected > 0 ? 'text-foreground' : 'text-destructive'}>{totalSelected.toFixed(1)}s</span>
          </span>
          {segmentDuration > 0 && (
            <>
              <span className="text-xs font-mono text-muted-foreground">
                Need: <span className="text-primary">{segmentDuration.toFixed(1)}s</span>
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                {speedLabel}
              </span>
            </>
          )}
        </div>

        {/* Timeline track for current source */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-14 rounded-lg bg-muted/30 border border-border cursor-crosshair select-none overflow-hidden"
        >
          {visibleRangeIndices.map(ri => {
            const range = ranges[ri];
            return (
              <div key={ri}>
                <div
                  className={`absolute top-0 h-full transition-colors ${
                    ri === activeRange ? 'bg-primary/30 border-y-2 border-primary' : 'bg-primary/15 border-y border-primary/40'
                  }`}
                  style={{
                    left: `${timeToPercent(range.start)}%`,
                    width: `${timeToPercent(range.end) - timeToPercent(range.start)}%`,
                  }}
                  onClick={(e) => { e.stopPropagation(); setActiveRange(ri); }}
                />
                <div
                  onMouseDown={e => { e.stopPropagation(); setDragging({ rangeIndex: ri, edge: 'start' }); setActiveRange(ri); }}
                  className="absolute top-0 h-full w-3 cursor-col-resize z-10 group"
                  style={{ left: `${timeToPercent(range.start)}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
                </div>
                <div
                  onMouseDown={e => { e.stopPropagation(); setDragging({ rangeIndex: ri, edge: 'end' }); setActiveRange(ri); }}
                  className="absolute top-0 h-full w-3 cursor-col-resize z-10 group"
                  style={{ left: `${timeToPercent(range.end)}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
                </div>
                <div
                  className="absolute top-1 text-[8px] font-mono text-primary-foreground bg-primary/60 px-1 rounded pointer-events-none"
                  style={{
                    left: `${timeToPercent(range.start) + (timeToPercent(range.end) - timeToPercent(range.start)) / 2}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {(range.end - range.start).toFixed(1)}s
                </div>
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground z-20 pointer-events-none"
            style={{ left: `${timeToPercent(currentTime)}%` }}
          >
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rounded-full" />
          </div>

          <div className="absolute bottom-0.5 left-1 text-[8px] font-mono text-muted-foreground">0:00</div>
          <div className="absolute bottom-0.5 right-1 text-[8px] font-mono text-muted-foreground">{formatTime(currentDuration)}</div>
        </div>

        {/* Range list */}
        <div className="flex items-center gap-2 flex-wrap">
          {ranges.map((range, i) => (
            <div
              key={i}
              onClick={() => {
                setActiveRange(i);
                if (isMulti && range.sourceIndex !== undefined) setActiveSourceIndex(range.sourceIndex);
              }}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-mono cursor-pointer transition-all ${
                i === activeRange
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-secondary text-secondary-foreground border border-transparent hover:border-border'
              }`}
            >
              {isMulti && range.sourceIndex !== undefined && (
                <span className="text-muted-foreground">P{range.sourceIndex + 1}</span>
              )}
              <span>{formatTime(range.start)} → {formatTime(range.end)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeRange(i); }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addRange}
            className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] font-mono text-secondary-foreground hover:bg-secondary/80 transition-colors border border-dashed border-border"
          >
            <Plus className="h-2.5 w-2.5" />
            Add Range
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {isMulti
            ? `Select parts from any product video. Combined clips will be speed-adjusted to fill the ${segmentDuration.toFixed(1)}s segment.`
            : `Select multiple parts of the video you like. The combined clips will be speed-adjusted to fill the ${segmentDuration.toFixed(1)}s segment.`
          }
        </p>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => ranges.length > 0 && onConfirm(ranges)}
            disabled={ranges.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Confirm Trim
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
