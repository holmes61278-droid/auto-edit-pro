import { Wand2, Download, RotateCcw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductClip, Segment } from '@/types/editor';

interface ProcessButtonProps {
  voiceover: File | null;
  clips: (ProductClip | null)[];
  segments: Segment[];
  isProcessing: boolean;
  progress: number;
  outputUrl: string | null;
  onProcess: () => void;
  onReset: () => void;
}

export function ProcessButton({
  voiceover,
  clips,
  segments,
  isProcessing,
  progress,
  outputUrl,
  onProcess,
  onReset,
}: ProcessButtonProps) {
  const allClipsReady = clips.every(c => c !== null && c.trimRanges.length > 0);
  const readyCount = clips.filter(c => c !== null && c.trimRanges.length > 0).length;
  const isReady = voiceover && allClipsReady && segments.length === 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        Step 4 — Generate
      </h3>

      <div className="flex items-center gap-3">
        {outputUrl ? (
          <>
            <a
              href={outputUrl}
              download="edited-video.mp4"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:glow-primary"
            >
              <Download className="h-4 w-4" />
              Download Video
            </a>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition-all hover:bg-secondary/80"
            >
              <RotateCcw className="h-4 w-4" />
              Start Over
            </button>
          </>
        ) : isProcessing ? (
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <span className="text-sm text-foreground">Processing video...</span>
              <span className="text-xs font-mono text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={onProcess}
            disabled={!isReady}
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ${
              isReady
                ? 'bg-primary text-primary-foreground hover:glow-primary'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            <Wand2 className="h-4 w-4" />
            Generate Video
          </button>
        )}
      </div>

      {!isReady && !isProcessing && !outputUrl && (
        <p className="text-[11px] text-muted-foreground">
          {!voiceover
            ? 'Upload a voiceover to get started.'
            : !allClipsReady
            ? `Upload and trim all 7 clips (${readyCount}/7 done).`
            : 'Adjust the timeline segments above, then generate.'}
        </p>
      )}
    </motion.div>
  );
}
