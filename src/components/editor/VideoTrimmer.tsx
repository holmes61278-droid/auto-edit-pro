import { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Check, X, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { TrimRange } from '@/types/editor';

interface VideoTrimmerProps {
  videoUrl: string;
  videoDuration: number;
  initialRanges: TrimRange[];
  segmentDuration: number;
  label: string;
  onConfirm: (ranges: TrimRange[]) => void;
  onCancel: () => void;
}

export function VideoTrimmer({
  videoUrl,
  videoDuration,
  initialRanges,
  segmentDuration,
  label,
  onConfirm,
  onCancel,
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [ranges, setRanges] = useState<TrimRange[]>(
    initialRanges.length > 0 ? initialRanges : [{ start: 0, end: Math.min(videoDuration, segmentDuration || videoDuration) }]
  );
  const [dragging, setDragging] = useState<{ rangeIndex: number; edge: 'start' | 'end' } | null>(null);
  const [activeRange, setActiveRange] = useState(0);

  const totalSelected = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  const speedFactor = totalSelected / segmentDuration;
  const speedLabel = speedFactor > 1 ? `${speedFactor.toFixed(2)}x faster` : speedFactor < 1 ? `${(1/speedFactor).toFixed(2)}x slower` : '1x';

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

  const timeToPercent = (t: number) => (t / videoDuration) * 100;

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current) return;
    const x = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(videoDuration, x * videoDuration));
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, [videoDuration, dragging]);

  // Add a new range at a gap
  const addRange = useCallback(() => {
    // Find the largest gap
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    let bestStart = 0;
    let bestEnd = 0;
    let bestLen = 0;

    // Check gap before first range
    if (sorted.length === 0 || sorted[0].start > 0) {
      const gapEnd = sorted.length > 0 ? sorted[0].start : videoDuration;
      if (gapEnd > bestLen) {
        bestStart = 0;
        bestEnd = gapEnd;
        bestLen = gapEnd;
      }
    }

    // Check gaps between ranges
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapStart = sorted[i].end;
      const gapEnd = sorted[i + 1].start;
      const gapLen = gapEnd - gapStart;
      if (gapLen > bestLen) {
        bestStart = gapStart;
        bestEnd = gapEnd;
        bestLen = gapLen;
      }
    }

    // Check gap after last range
    if (sorted.length > 0) {
      const lastEnd = sorted[sorted.length - 1].end;
      const gapLen = videoDuration - lastEnd;
      if (gapLen > bestLen) {
        bestStart = lastEnd;
        bestEnd = videoDuration;
        bestLen = gapLen;
      }
    }

    if (bestLen < 0.5) return; // No space

    // Place new range in the middle of the gap, ~2s or gap size
    const rangeSize = Math.min(bestLen, 2);
    const center = (bestStart + bestEnd) / 2;
    const newRange: TrimRange = {
      start: Math.max(bestStart, center - rangeSize / 2),
      end: Math.min(bestEnd, center + rangeSize / 2),
    };

    const newRanges = [...ranges, newRange].sort((a, b) => a.start - b.start);
    setRanges(newRanges);
    setActiveRange(newRanges.indexOf(newRange));
  }, [ranges, videoDuration]);

  const removeRange = useCallback((index: number) => {
    if (ranges.length <= 1) return;
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
      const time = x * videoDuration;
      const { rangeIndex, edge } = dragging;

      setRanges(prev => {
        const newRanges = [...prev];
        const range = { ...newRanges[rangeIndex] };

        // Get boundaries from adjacent ranges
        const sorted = [...newRanges].sort((a, b) => a.start - b.start);
        const sortedIdx = sorted.findIndex(r => r === newRanges[rangeIndex]);

        if (edge === 'start') {
          const minStart = sortedIdx > 0 ? sorted[sortedIdx - 1].end : 0;
          range.start = Math.max(minStart, Math.min(time, range.end - 0.3));
        } else {
          const maxEnd = sortedIdx < sorted.length - 1 ? sorted[sortedIdx + 1].start : videoDuration;
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
  }, [dragging, videoDuration]);

  // Seek video when active range changes
  useEffect(() => {
    if (videoRef.current && !isPlaying && ranges[activeRange]) {
      videoRef.current.currentTime = ranges[activeRange].start;
      setCurrentTime(ranges[activeRange].start);
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
        className="w-full max-w-3xl rounded-xl bg-card border border-border p-5 space-y-4 shadow-2xl"
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

        {/* Video preview */}
        <div className="relative rounded-lg overflow-hidden bg-background aspect-video">
          <video
            ref={videoRef}
            src={videoUrl}
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
            {formatTime(currentTime)} / {formatTime(videoDuration)}
          </span>
          <div className="flex-1" />
          <span className="text-xs font-mono text-muted-foreground">
            Selected: <span className={totalSelected > 0 ? 'text-foreground' : 'text-destructive'}>{totalSelected.toFixed(1)}s</span>
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            Need: <span className="text-primary">{segmentDuration.toFixed(1)}s</span>
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
            {speedLabel}
          </span>
        </div>

        {/* Multi-range track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-14 rounded-lg bg-muted/30 border border-border cursor-crosshair select-none overflow-hidden"
        >
          {/* Ranges */}
          {ranges.map((range, i) => (
            <div key={i}>
              {/* Range fill */}
              <div
                className={`absolute top-0 h-full transition-colors ${
                  i === activeRange ? 'bg-primary/30 border-y-2 border-primary' : 'bg-primary/15 border-y border-primary/40'
                }`}
                style={{
                  left: `${timeToPercent(range.start)}%`,
                  width: `${timeToPercent(range.end) - timeToPercent(range.start)}%`,
                }}
                onClick={(e) => { e.stopPropagation(); setActiveRange(i); }}
              />

              {/* Start handle */}
              <div
                onMouseDown={e => { e.stopPropagation(); setDragging({ rangeIndex: i, edge: 'start' }); setActiveRange(i); }}
                className="absolute top-0 h-full w-3 cursor-col-resize z-10 group"
                style={{ left: `${timeToPercent(range.start)}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
              </div>

              {/* End handle */}
              <div
                onMouseDown={e => { e.stopPropagation(); setDragging({ rangeIndex: i, edge: 'end' }); setActiveRange(i); }}
                className="absolute top-0 h-full w-3 cursor-col-resize z-10 group"
                style={{ left: `${timeToPercent(range.end)}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
              </div>

              {/* Range label */}
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
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground z-20 pointer-events-none"
            style={{ left: `${timeToPercent(currentTime)}%` }}
          >
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rounded-full" />
          </div>

          {/* Time markers */}
          <div className="absolute bottom-0.5 left-1 text-[8px] font-mono text-muted-foreground">0:00</div>
          <div className="absolute bottom-0.5 right-1 text-[8px] font-mono text-muted-foreground">{formatTime(videoDuration)}</div>
        </div>

        {/* Range list + add button */}
        <div className="flex items-center gap-2 flex-wrap">
          {ranges.map((range, i) => (
            <div
              key={i}
              onClick={() => setActiveRange(i)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-mono cursor-pointer transition-all ${
                i === activeRange
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-secondary text-secondary-foreground border border-transparent hover:border-border'
              }`}
            >
              <span>{formatTime(range.start)} → {formatTime(range.end)}</span>
              {ranges.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeRange(i); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
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
          Select multiple parts of the video you like. The combined clips will be speed-adjusted to fill the {segmentDuration.toFixed(1)}s segment.
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
            onClick={() => onConfirm(ranges)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all"
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
