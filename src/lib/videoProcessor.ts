import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { ProductClip, Segment } from '@/types/editor';

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  const instance = new FFmpeg();

  instance.on('progress', ({ progress }) => {
    onProgress?.(Math.min(95, Math.max(12, progress * 100)));
  });

  instance.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

  try {
    onProgress?.(3);
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
    onProgress?.(5);
    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
    onProgress?.(9);
    await instance.load({ coreURL, wasmURL });
    ffmpeg = instance;
    return instance;
  } catch (err) {
    console.error('[FFmpeg] Failed to load:', err);
    ffmpeg = null;
    throw new Error(
      'Failed to load video engine. Please check your internet connection and try again. ' +
      '(The first load downloads ~30MB of processing files.)'
    );
  }
}

export async function processVideo(
  voiceover: File,
  clips: ProductClip[],
  segments: Segment[],
  onProgress: (progress: number) => void
): Promise<string> {
  onProgress(2);
  const ff = await getFFmpeg(onProgress);
  onProgress(10);

  // Write voiceover
  await ff.writeFile('voiceover.mp3', await fetchFile(voiceover));
  onProgress(15);

  // Write all 7 clips
  for (let i = 0; i < clips.length; i++) {
    await ff.writeFile(`clip${i}.mp4`, await fetchFile(clips[i].file));
    onProgress(15 + (i + 1) * 3);
  }

  // For each segment, extract the trimmed portion from its corresponding clip
  const segmentFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segDuration = seg.endTime - seg.startTime;
    const clip = clips[i]; // Each segment now has its own clip (index 0-6)
    const outputName = `seg${i}.mp4`;

    // Use the manual trim values from the clip
    const trimStart = clip.trimStart;
    const trimDuration = clip.trimEnd - clip.trimStart;

    // Extract the trimmed portion, then speed-adjust to fit the segment duration
    // If trimmed portion differs from segment duration, we adjust speed
    const speedFactor = trimDuration / segDuration;

    if (Math.abs(speedFactor - 1) < 0.05) {
      // Close enough to 1:1, just cut directly
      await ff.exec([
        '-ss', trimStart.toFixed(3),
        '-i', `clip${i}.mp4`,
        '-t', segDuration.toFixed(3),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-y', outputName,
      ]);
    } else {
      // Speed adjust: setpts to fit trimmed content into segment duration
      const setptsValue = (1 / speedFactor).toFixed(4);
      await ff.exec([
        '-ss', trimStart.toFixed(3),
        '-i', `clip${i}.mp4`,
        '-t', trimDuration.toFixed(3),
        '-vf', `setpts=${setptsValue}*PTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2`,
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-y', outputName,
      ]);
    }

    segmentFiles.push(outputName);
    onProgress(36 + i * 7);
  }

  // Create concat file
  const concatContent = segmentFiles.map(f => `file '${f}'`).join('\n');
  await ff.writeFile('concat.txt', concatContent);

  // Concatenate all segments
  await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-y', 'video_only.mp4',
  ]);
  onProgress(85);

  // Add voiceover audio
  await ff.exec([
    '-i', 'video_only.mp4',
    '-i', 'voiceover.mp3',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    '-y', 'output.mp4',
  ]);
  onProgress(95);

  // Read output
  const data = await ff.readFile('output.mp4');
  const uint8 = data as Uint8Array;
  const blob = new Blob([uint8.buffer as ArrayBuffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);

  onProgress(100);
  return url;
}
