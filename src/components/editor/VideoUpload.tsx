import { useCallback, useRef } from 'react';
import { Upload, Film, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductClip } from '@/types/editor';

interface VideoUploadProps {
  clips: (ProductClip | null)[];
  onUpload: (index: number, clip: ProductClip | null) => void;
}

const LABELS = ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5'];

export function VideoUpload({ clips, onUpload }: VideoUploadProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        Step 2 — Product Clips (in order)
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {LABELS.map((label, i) => (
          <ClipSlot
            key={i}
            index={i}
            label={label}
            clip={clips[i]}
            onUpload={onUpload}
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
  onUpload,
}: {
  index: number;
  label: string;
  clip: ProductClip | null;
  onUpload: (index: number, clip: ProductClip | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        // Generate thumbnail
        video.currentTime = 1;
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0, 160, 90);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          onUpload(index, {
            id: `clip-${index}`,
            file,
            url,
            duration: video.duration,
            index,
            thumbnail,
          });
        };
      };
      video.src = url;
    },
    [index, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => !clip && inputRef.current?.click()}
      className={`relative aspect-video cursor-pointer rounded-md border-2 border-dashed transition-all overflow-hidden ${
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
        }}
        className="hidden"
      />
      {clip ? (
        <>
          {clip.thumbnail && (
            <img
              src={clip.thumbnail}
              alt={label}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40">
            <Check className="h-4 w-4 text-primary mb-1" />
            <p className="text-[10px] font-mono text-foreground">{label}</p>
            <p className="text-[9px] font-mono text-muted-foreground">
              {clip.duration.toFixed(1)}s
            </p>
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              URL.revokeObjectURL(clip.url);
              onUpload(index, null);
            }}
            className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1">
          <Film className="h-4 w-4 text-muted-foreground" />
          <p className="text-[10px] font-mono text-muted-foreground">{label}</p>
        </div>
      )}
    </div>
  );
}
