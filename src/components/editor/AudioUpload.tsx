import { useCallback, useRef } from 'react';
import { Upload, Music, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface AudioUploadProps {
  voiceoverUrl: string | null;
  voiceoverDuration: number;
  onUpload: (file: File, url: string, duration: number) => void;
}

export function AudioUpload({ voiceoverUrl, voiceoverDuration, onUpload }: AudioUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      onUpload(file, url, audio.duration);
    });
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isUploaded = !!voiceoverUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        Step 1 — Voiceover
      </h3>
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all ${
          isUploaded
            ? 'border-primary/40 bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-secondary/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={handleChange}
          className="hidden"
        />
        {isUploaded ? (
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Voiceover uploaded</p>
              <p className="text-xs font-mono text-muted-foreground">
                {voiceoverDuration.toFixed(1)}s duration
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Music className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop your voiceover audio here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                MP3, WAV, M4A • Under 1 minute
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
