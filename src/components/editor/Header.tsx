import { Clapperboard } from 'lucide-react';

export function Header() {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 glow-primary-sm">
        <Clapperboard className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">ClipForge</h1>
        <p className="text-[11px] text-muted-foreground font-mono">Auto Video Editor</p>
      </div>
    </header>
  );
}
