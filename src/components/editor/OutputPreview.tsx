import { motion } from 'framer-motion';

interface OutputPreviewProps {
  outputUrl: string | null;
}

export function OutputPreview({ outputUrl }: OutputPreviewProps) {
  if (!outputUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        Output Preview
      </h3>
      <div className="rounded-lg overflow-hidden border border-border bg-timeline-bg">
        <video
          src={outputUrl}
          controls
          className="w-full max-h-[400px]"
        />
      </div>
    </motion.div>
  );
}
