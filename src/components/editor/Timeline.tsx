import { useRef, useState, useCallback, useEffect } from 'react';
import { Segment } from '@/types/editor';
import { Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

interface TimelineProps {
  voiceoverUrl: string | null;
  duration: number;
  segments: Segment[];
  onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
}

const SEGMENT_COLORS: Record<string, string> = {
  hook: 'bg-segment-hook',
  product: 'bg-segment-product',
  cta: 'bg-segment-cta',
};

const SEGMENT_BORDER_COLORS: Record<string, string> = {
  hook: 'border-segment-hook',
  product: 'border-segment-product',
  cta: 'border-segment-cta',
};

export function Timeline({ voiceoverUrl, duration, segments, onUpdateSegment }: TimelineProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [draggingHandle, setDraggingHandle] = useState<{ segmentIndex: number; edge: 'start' | 'end' } | null>(null);

  // Generate waveform from audio
  useEffect(() => {
    if (!voiceoverUrl) return;
    const audioContext = new AudioContext();
    fetch(voiceoverUrl)
      .then(r => r.arrayBuffer())
      .then(buf => audioContext.decodeAudioData(buf))
      .then(audioBuffer => {
        const rawData = audioBuffer.getChannelData(0);
        const samples = 200;
        const blockSize = Math.floor(rawData.length / samples);
        const data: number[] = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          data.push(sum / blockSize);
        }
        const max = Math.max(...data);
        setWaveformData(data.map(d => d / max));
      });
  }, [voiceoverUrl]);

  // Track playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setCurrentTime(audio.currentTime);
    const ended = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('ended', ended);
    return () => {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('ended', ended);
    };
  }, [voiceoverUrl]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !audioRef.current) return;
    const x = (e.clientX - rect.left) / rect.width;
    const time = x * duration;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, [duration]);

  // Handle segment boundary dragging
  const handleMouseDown = useCallback((segmentIndex: number, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingHandle({ segmentIndex, edge });
  }, []);

  useEffect(() => {
    if (!draggingHandle) return;
    const handleMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = x * duration;
      const { segmentIndex, edge } = draggingHandle;
      const seg = segments[segmentIndex];
      if (!seg) return;

      if (edge === 'start' && segmentIndex > 0) {
        const prev = segments[segmentIndex - 1];
        const clamped = Math.max(prev.startTime + 0.1, Math.min(time, seg.endTime - 0.1));
        onUpdateSegment(prev.id, { endTime: clamped });
        onUpdateSegment(seg.id, { startTime: clamped });
      } else if (edge === 'end' && segmentIndex < segments.length - 1) {
        const next = segments[segmentIndex + 1];
        const clamped = Math.max(seg.startTime + 0.1, Math.min(time, next.endTime - 0.1));
        onUpdateSegment(seg.id, { endTime: clamped });
        onUpdateSegment(next.id, { startTime: clamped });
      }
    };
    const handleUp = () => setDraggingHandle(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingHandle, segments, duration, onUpdateSegment]);

  if (!voiceoverUrl) return null;

  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          Step 3 — Timeline
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:glow-primary"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>
          <span className="text-xs font-mono text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      <audio ref={audioRef} src={voiceoverUrl} />

      {/* Timeline container */}
      <div
        ref={containerRef}
        onClick={seekTo}
        className="relative h-32 cursor-crosshair rounded-lg bg-timeline-bg border border-border overflow-hidden select-none"
      >
        {/* Waveform */}
        <div className="absolute inset-0 flex items-center justify-center px-1">
          <div className="flex h-full w-full items-center gap-[1px]">
            {waveformData.map((amp, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-waveform/30"
                style={{
                  height: `${Math.max(4, amp * 80)}%`,
                  alignSelf: 'center',
                }}
              />
            ))}
          </div>
        </div>

        {/* Segments overlay */}
        <div className="absolute inset-0">
          {segments.map((seg, i) => {
            const left = (seg.startTime / duration) * 100;
            const width = ((seg.endTime - seg.startTime) / duration) * 100;
            return (
              <div
                key={seg.id}
                className={`absolute top-0 h-full border-l-2 ${SEGMENT_BORDER_COLORS[seg.type]} ${SEGMENT_COLORS[seg.type]}/10`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div className={`absolute top-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${SEGMENT_COLORS[seg.type]}/80 backdrop-blur-sm`}>
                  <span className="text-foreground/90">{seg.label}</span>
                </div>
                {/* Drag handles */}
                {i > 0 && (
                  <div
                    onMouseDown={e => handleMouseDown(i, 'start', e)}
                    className="absolute left-0 top-0 h-full w-2 cursor-col-resize hover:bg-foreground/20 -translate-x-1"
                  />
                )}
                {i < segments.length - 1 && (
                  <div
                    onMouseDown={e => handleMouseDown(i, 'end', e)}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-foreground/20 translate-x-1"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground z-10 pointer-events-none"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-foreground rounded-full" />
        </div>

        {/* Segment labels at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-background/60 backdrop-blur-sm flex">
          {segments.map(seg => {
            const left = (seg.startTime / duration) * 100;
            const width = ((seg.endTime - seg.startTime) / duration) * 100;
            return (
              <div
                key={seg.id}
                className="flex items-center justify-center overflow-hidden"
                style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%' }}
              >
                <span className="text-[8px] font-mono text-muted-foreground truncate px-1">
                  {formatTime(seg.startTime)}-{formatTime(seg.endTime)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Drag segment boundaries to adjust timing. Click to seek.
      </p>
    </motion.div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
