import { useCallback, useRef, useState } from 'react';
import { Upload, Film, Check, X, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductClip, CLIP_LABELS, Segment } from '@/types/editor';
import { VideoTrimmer } from './VideoTrimmer';

interface VideoUploadProps {
  clips: (ProductClip | null)[];
  segments: Segment[];
  onUpload: (index: number, clip: ProductClip | null) => void;
  onUpdateTrim: (index: number, trimStart: number, trimEnd: number) => void;
}

export function VideoUpload({ clips, segments, onUpload, onUpdateTrim }: VideoUploadProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        Step 2 — Video Clips (one per segment)
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {CLIP_LABELS.map((label, i) => (
          <ClipSlot
            key={i}
            index={i}
            label={label}
            clip={clips[i] ?? null}
            segment={segments?.[i]}
            onUpload={onUpload}
            onUpdateTrim={onUpdateTrim}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ClipSlot({
  index,
  label,
  clip,
  segment,
  onUpload,
  onUpdateTrim,
}: {
  index: number;
  label: string;
  clip: ProductClip | null;
  segment: Segment | undefined;
  onUpload: (index: number, clip: ProductClip | null) => void;
  onUpdateTrim: (index: number, trimStart: number, trimEnd: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; url: string; duration: number } | null>(null);

  const segmentDuration = segment ? segment.endTime - segment.startTime : 0;

  const handleFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setPendingFile({ file, url, duration: video.duration });
        setShowTrimmer(true);
      };
      video.src = url;
    },
    []
  );

  const handleTrimConfirm = useCallback(
    (trimStart: number, trimEnd: number) => {
      if (!pendingFile) return;
      // Generate thumbnail
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = trimStart + 0.5;
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0, 160, 90);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          onUpload(index, {
            id: `clip-${index}`,
            file: pendingFile.file,
            url: pendingFile.url,
            duration: pendingFile.duration,
            index,
            thumbnail,
            trimStart,
            trimEnd,
          });
          setShowTrimmer(false);
          setPendingFile(null);
        };
      };
      video.src = pendingFile.url;
    },
    [index, onUpload, pendingFile]
  );

  const handleTrimCancel = useCallback(() => {
    if (pendingFile) {
      URL.revokeObjectURL(pendingFile.url);
    }
    setShowTrimmer(false);
    setPendingFile(null);
  }, [pendingFile]);

  const handleRetrim = useCallback(() => {
    if (!clip) return;
    setPendingFile({ file: clip.file, url: clip.url, duration: clip.duration });
    setShowTrimmer(true);
  }, [clip]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) handleFile(file);
    },
    [handleFile]
  );

  const trimmedDuration = clip ? clip.trimEnd - clip.trimStart : 0;

  return (
    <>
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !clip && inputRef.current?.click()}
        className={`relative aspect-[9/16] cursor-pointer rounded-md border-2 border-dashed transition-all overflow-hidden ${
          clip
            ? 'border-primary/30 bg-primary/5'
            : 'border-border hover:border-primary/40 hover:bg-secondary/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
          className="hidden"
        />
        {clip ? (
          <>
            {clip.thumbnail && (
              <img
                src={clip.thumbnail}
                alt={label}
                className="absolute inset-0 h-full w-full object-cover opacity-50"
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 gap-1">
              <Check className="h-3.5 w-3.5 text-primary" />
              <p className="text-[9px] font-mono text-foreground font-medium">{label}</p>
              <p className="text-[8px] font-mono text-muted-foreground">
                {trimmedDuration.toFixed(1)}s trimmed
              </p>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleRetrim();
                }}
                className="mt-1 flex items-center gap-0.5 rounded bg-secondary/80 px-1.5 py-0.5 text-[8px] font-mono text-secondary-foreground hover:bg-secondary transition-colors"
              >
                <Scissors className="h-2.5 w-2.5" />
                Retrim
              </button>
            </div>
            <button
              onClick={e => {
                e.stopPropagation();
                URL.revokeObjectURL(clip.url);
                onUpload(index, null);
              }}
              className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-1">
            <Film className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[8px] font-mono text-muted-foreground text-center leading-tight">{label}</p>
            {segmentDuration > 0 && (
              <p className="text-[7px] font-mono text-primary/70">{segmentDuration.toFixed(1)}s</p>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showTrimmer && pendingFile && (
          <VideoTrimmer
            videoUrl={pendingFile.url}
            videoDuration={pendingFile.duration}
            trimStart={clip?.trimStart ?? 0}
            trimEnd={clip?.trimEnd ?? Math.min(pendingFile.duration, segmentDuration || pendingFile.duration)}
            segmentDuration={segmentDuration}
            label={label}
            onConfirm={handleTrimConfirm}
            onCancel={handleTrimCancel}
          />
        )}
      </AnimatePresence>
    </>
  );
}
