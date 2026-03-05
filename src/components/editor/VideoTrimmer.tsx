import { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface VideoTrimmerProps {
  videoUrl: string;
  videoDuration: number;
  trimStart: number;
  trimEnd: number;
  segmentDuration: number; // The voiceover segment duration this clip must fill
  label: string;
  onConfirm: (trimStart: number, trimEnd: number) => void;
  onCancel: () => void;
}

export function VideoTrimmer({
  videoUrl,
  videoDuration,
  trimStart,
  trimEnd,
  segmentDuration,
  label,
  onConfirm,
  onCancel,
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(trimStart);
  const [start, setStart] = useState(trimStart);
  const [end, setEnd] = useState(trimEnd);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const selectedDuration = end - start;

  // Sync video to current time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      setCurrentTime(video.currentTime);
      // Loop within trim range
      if (video.currentTime >= end) {
        video.currentTime = start;
      }
    };
    const ended = () => setIsPlaying(false);
    video.addEventListener('timeupdate', update);
    video.addEventListener('ended', ended);
    return () => {
      video.removeEventListener('timeupdate', update);
      video.removeEventListener('ended', ended);
    };
  }, [start, end]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime < start || video.currentTime >= end) {
        video.currentTime = start;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, start, end]);

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

  // Drag handlers
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = x * videoDuration;

      if (dragging === 'start') {
        setStart(Math.max(0, Math.min(time, end - 0.5)));
      } else {
        setEnd(Math.min(videoDuration, Math.max(time, start + 0.5)));
      }
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, start, end, videoDuration]);

  // Seek video when trim handles move
  useEffect(() => {
    if (videoRef.current && !isPlaying) {
      videoRef.current.currentTime = start;
      setCurrentTime(start);
    }
  }, [start]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-card border border-border p-5 space-y-4 shadow-2xl"
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
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:glow-primary"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>
          <span className="text-xs font-mono text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(videoDuration)}
          </span>
          <div className="flex-1" />
          <span className="text-xs font-mono text-muted-foreground">
            Selected: <span className="text-foreground">{selectedDuration.toFixed(1)}s</span>
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            Segment: <span className="text-primary">{segmentDuration.toFixed(1)}s</span>
          </span>
        </div>

        {/* Trim track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-12 rounded-lg bg-timeline-bg border border-border cursor-crosshair select-none overflow-hidden"
        >
          {/* Full track background */}
          <div className="absolute inset-0 bg-muted/20" />

          {/* Selected range */}
          <div
            className="absolute top-0 h-full bg-primary/20 border-x-2 border-primary/60"
            style={{
              left: `${timeToPercent(start)}%`,
              width: `${timeToPercent(end) - timeToPercent(start)}%`,
            }}
          />

          {/* Start handle */}
          <div
            onMouseDown={e => { e.stopPropagation(); setDragging('start'); }}
            className="absolute top-0 h-full w-3 cursor-col-resize z-10 group"
            style={{ left: `${timeToPercent(start)}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
          </div>

          {/* End handle */}
          <div
            onMouseDown={e => { e.stopPropagation(); setDragging('end'); }}
            className="absolute top-0 h-full w-3 cursor-col-resize z-10 group"
            style={{ left: `${timeToPercent(end)}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground z-20 pointer-events-none"
            style={{ left: `${timeToPercent(currentTime)}%` }}
          >
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rounded-full" />
          </div>

          {/* Time labels */}
          <div className="absolute bottom-0.5 left-1 text-[8px] font-mono text-muted-foreground">
            {formatTime(start)}
          </div>
          <div className="absolute bottom-0.5 right-1 text-[8px] font-mono text-muted-foreground">
            {formatTime(end)}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Drag the handles to select which part of the video to use for this segment. 
          The selected portion will fill the {segmentDuration.toFixed(1)}s segment.
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
            onClick={() => onConfirm(start, end)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:glow-primary transition-all"
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
