import { useCallback } from 'react';
import { useEditorState } from '@/hooks/useEditorState';
import { Header } from '@/components/editor/Header';
import { AudioUpload } from '@/components/editor/AudioUpload';
import { VideoUpload } from '@/components/editor/VideoUpload';
import { Timeline } from '@/components/editor/Timeline';
import { ProcessButton } from '@/components/editor/ProcessButton';
import { OutputPreview } from '@/components/editor/OutputPreview';
import { processVideo } from '@/lib/videoProcessor';
import { ProductClip } from '@/types/editor';
import { toast } from 'sonner';

const Index = () => {
  const {
    state,
    setVoiceover,
    setProductClip,
    updateSegment,
    setProcessing,
    setProgress,
    setOutputUrl,
    reset,
  } = useEditorState();

  const handleProcess = useCallback(async () => {
    if (!state.voiceover) return;
    const clips = state.productClips.filter(Boolean) as ProductClip[];
    if (clips.length !== 5) return;

    setProcessing(true, 0);
    try {
      const url = await processVideo(
        state.voiceover,
        clips,
        state.segments,
        setProgress
      );
      setOutputUrl(url);
      toast.success('Video generated successfully!');
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Failed to process video. Try shorter clips or a different format.');
      setProcessing(false, 0);
    }
  }, [state, setProcessing, setProgress, setOutputUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <AudioUpload
            voiceoverUrl={state.voiceoverUrl}
            voiceoverDuration={state.voiceoverDuration}
            onUpload={setVoiceover}
          />

          <VideoUpload
            clips={state.productClips}
            onUpload={setProductClip}
          />

          <Timeline
            voiceoverUrl={state.voiceoverUrl}
            duration={state.voiceoverDuration}
            segments={state.segments}
            onUpdateSegment={updateSegment}
          />

          <ProcessButton
            voiceover={state.voiceover}
            clips={state.productClips}
            segments={state.segments}
            isProcessing={state.isProcessing}
            progress={state.progress}
            outputUrl={state.outputUrl}
            onProcess={handleProcess}
            onReset={reset}
          />

          <OutputPreview outputUrl={state.outputUrl} />
        </div>
      </main>
    </div>
  );
};

export default Index;
