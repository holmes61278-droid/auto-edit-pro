import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Film, Check, X, Scissors, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductClip, CLIP_LABELS, Segment, TrimRange } from '@/types/editor';
import { VideoTrimmer } from './VideoTrimmer';

interface VideoUploadProps {
  clips: (ProductClip | null)[];
  segments: Segment[];
  onUpload: (index: number, clip: ProductClip | null) => void;
  onUpdateTrimRanges: (index: number, trimRanges: TrimRange[]) => void;
}

export function VideoUpload({ clips, segments, onUpload, onUpdateTrimRanges }: VideoUploadProps) {
  // Get product clips (indices 1-5)
  const productClips = clips.slice(1, 6);
  const allProductsUploaded = productClips.every(c => c !== null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        Step 2 — Video Clips
      </h3>

      {/* Product slots (1-5) */}
      <p className="text-[11px] font-mono text-muted-foreground">Upload 5 product videos — Hook & CTA will auto-fill from these.</p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <ClipSlot
            key={i}
            index={i}
            label={CLIP_LABELS[i]}
            clip={clips[i] ?? null}
            segment={segments?.[i]}
            onUpload={onUpload}
            onUpdateTrimRanges={onUpdateTrimRanges}
          />
        ))}
      </div>

      {/* Hook & CTA (auto-populated) */}
      <div className="grid grid-cols-2 gap-2">
        <AutoSlot
          index={0}
          label="Hook"
          clip={clips[0] ?? null}
          segment={segments?.[0]}
          productClips={productClips as (ProductClip | null)[]}
          allProductsUploaded={allProductsUploaded}
          onUpload={onUpload}
          onUpdateTrimRanges={onUpdateTrimRanges}
        />
        <AutoSlot
          index={6}
          label="CTA"
          clip={clips[6] ?? null}
          segment={segments?.[6]}
          productClips={productClips as (ProductClip | null)[]}
          allProductsUploaded={allProductsUploaded}
          onUpload={onUpload}
          onUpdateTrimRanges={onUpdateTrimRanges}
        />
      </div>
    </motion.div>
  );
}

/* ── Auto-populated slot for Hook / CTA ── */
function AutoSlot({
  index,
  label,
  clip,
  segment,
  productClips,
  allProductsUploaded,
  onUpload,
  onUpdateTrimRanges,
}: {
  index: number;
  label: string;
  clip: ProductClip | null;
  segment: Segment | undefined;
  productClips: (ProductClip | null)[];
  allProductsUploaded: boolean;
  onUpload: (index: number, clip: ProductClip | null) => void;
  onUpdateTrimRanges: (index: number, trimRanges: TrimRange[]) => void;
}) {
  const [showTrimmer, setShowTrimmer] = useState(false);
  const segmentDuration = segment ? segment.endTime - segment.startTime : 0;

  const validProducts = useMemo(
    () => productClips.filter((c): c is ProductClip => c !== null),
    [productClips]
  );

  // Auto-create clip entry when all products uploaded (but no trim yet)
  useEffect(() => {
    if (allProductsUploaded && !clip) {
      onUpload(index, {
        id: `clip-${index}`,
        file: validProducts[0].file, // placeholder, actual sources come from trimRanges.sourceIndex
        url: validProducts[0].url,
        duration: 0,
        index,
        trimRanges: [],
      });
    }
  }, [allProductsUploaded, clip, index, validProducts, onUpload]);

  const handleTrimConfirm = useCallback((trimRanges: TrimRange[]) => {
    const totalSelected = trimRanges.reduce((s, r) => s + (r.end - r.start), 0);
    onUpload(index, {
      id: `clip-${index}`,
      file: validProducts[0].file,
      url: validProducts[0].url,
      duration: totalSelected,
      index,
      trimRanges,
    });
    setShowTrimmer(false);
  }, [index, onUpload, validProducts]);

  const totalTrimmed = clip?.trimRanges ? clip.trimRanges.reduce((s, r) => s + (r.end - r.start), 0) : 0;

  return (
    <>
      <div
        onClick={() => allProductsUploaded && setShowTrimmer(true)}
        className={`relative rounded-md border-2 border-dashed transition-all overflow-hidden p-3 ${
          !allProductsUploaded
            ? 'border-border bg-muted/20 opacity-50 cursor-not-allowed'
            : clip?.trimRanges?.length
            ? 'border-primary/30 bg-primary/5 cursor-pointer'
            : 'border-border hover:border-primary/40 hover:bg-secondary/30 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Link className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-semibold text-foreground">{label}</p>
            {!allProductsUploaded ? (
              <p className="text-[10px] font-mono text-muted-foreground">Upload all 5 products first</p>
            ) : clip?.trimRanges?.length ? (
              <p className="text-[10px] font-mono text-muted-foreground">
                {clip.trimRanges.length} cut{clip.trimRanges.length > 1 ? 's' : ''} · {totalTrimmed.toFixed(1)}s
                {segmentDuration > 0 && <span className="text-primary ml-1">→ {segmentDuration.toFixed(1)}s</span>}
              </p>
            ) : (
              <p className="text-[10px] font-mono text-primary">Click to trim from products · {segmentDuration.toFixed(1)}s needed</p>
            )}
          </div>
          {clip?.trimRanges?.length ? (
            <div className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-primary" />
              <button
                onClick={e => { e.stopPropagation(); setShowTrimmer(true); }}
                className="flex items-center gap-0.5 rounded bg-secondary/80 px-1.5 py-0.5 text-[8px] font-mono text-secondary-foreground hover:bg-secondary transition-colors"
              >
                <Scissors className="h-2.5 w-2.5" /> Retrim
              </button>
            </div>
          ) : allProductsUploaded ? (
            <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {showTrimmer && allProductsUploaded && (
          <VideoTrimmer
            videoUrl={validProducts[0].url}
            videoDuration={validProducts[0].duration}
            initialRanges={clip?.trimRanges ?? []}
            segmentDuration={segmentDuration}
            label={label}
            onConfirm={handleTrimConfirm}
            onCancel={() => setShowTrimmer(false)}
            multiSource={validProducts.map((p, i) => ({
              url: p.url,
              duration: p.duration,
              label: `Product ${i + 1}`,
            }))}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Standard clip slot for Products ── */
function ClipSlot({
  index,
  label,
  clip,
  segment,
  onUpload,
  onUpdateTrimRanges,
}: {
  index: number;
  label: string;
  clip: ProductClip | null;
  segment: Segment | undefined;
  onUpload: (index: number, clip: ProductClip | null) => void;
  onUpdateTrimRanges: (index: number, trimRanges: TrimRange[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; url: string; duration: number } | null>(null);

  const segmentDuration = segment ? segment.endTime - segment.startTime : 0;

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setPendingFile({ file, url, duration: video.duration });
      setShowTrimmer(true);
    };
    video.src = url;
  }, []);

  const handleTrimConfirm = useCallback((trimRanges: TrimRange[]) => {
    if (!pendingFile) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      video.currentTime = trimRanges[0].start + 0.5;
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
          trimRanges,
        });
        setShowTrimmer(false);
        setPendingFile(null);
      };
    };
    video.src = pendingFile.url;
  }, [index, onUpload, pendingFile]);

  const handleTrimCancel = useCallback(() => {
    if (pendingFile) URL.revokeObjectURL(pendingFile.url);
    setShowTrimmer(false);
    setPendingFile(null);
  }, [pendingFile]);

  const handleRetrim = useCallback(() => {
    if (!clip) return;
    setPendingFile({ file: clip.file, url: clip.url, duration: clip.duration });
    setShowTrimmer(true);
  }, [clip]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) handleFile(file);
  }, [handleFile]);

  const totalTrimmed = clip ? clip.trimRanges.reduce((s, r) => s + (r.end - r.start), 0) : 0;

  return (
    <>
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !clip && inputRef.current?.click()}
        className={`relative aspect-[9/16] cursor-pointer rounded-md border-2 border-dashed transition-all overflow-hidden ${
          clip ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-secondary/30'
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
              <img src={clip.thumbnail} alt={label} className="absolute inset-0 h-full w-full object-cover opacity-50" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 gap-1">
              <Check className="h-3.5 w-3.5 text-primary" />
              <p className="text-[9px] font-mono text-foreground font-medium">{label}</p>
              <p className="text-[8px] font-mono text-muted-foreground">
                {clip.trimRanges.length} cut{clip.trimRanges.length > 1 ? 's' : ''} · {totalTrimmed.toFixed(1)}s
              </p>
              <button
                onClick={e => { e.stopPropagation(); handleRetrim(); }}
                className="mt-1 flex items-center gap-0.5 rounded bg-secondary/80 px-1.5 py-0.5 text-[8px] font-mono text-secondary-foreground hover:bg-secondary transition-colors"
              >
                <Scissors className="h-2.5 w-2.5" />
                Retrim
              </button>
            </div>
            <button
              onClick={e => { e.stopPropagation(); URL.revokeObjectURL(clip.url); onUpload(index, null); }}
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
            initialRanges={clip?.trimRanges ?? []}
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
