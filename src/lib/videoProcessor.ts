import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { ProductClip, Segment } from '@/types/editor';

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.min(95, progress * 100));
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
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

  // Write all product clips
  for (let i = 0; i < clips.length; i++) {
    await ff.writeFile(`clip${i}.mp4`, await fetchFile(clips[i].file));
    onProgress(15 + (i + 1) * 5);
  }

  // For each segment, extract the matching portion from the corresponding clip
  // Hook & CTA use all clips mixed; product segments use specific clip
  const segmentFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segDuration = seg.endTime - seg.startTime;
    const outputName = `seg${i}.mp4`;

    let clipIndex: number;
    if (seg.type === 'hook') {
      clipIndex = 0; // Use first clip for hook
    } else if (seg.type === 'cta') {
      clipIndex = 4; // Use last clip for CTA
    } else {
      clipIndex = seg.productIndex ?? 0;
    }

    const clipFile = `clip${clipIndex}.mp4`;

    // Extract segment from clip, scaled to 1080x1920 (vertical) or auto
    await ff.exec([
      '-i', clipFile,
      '-t', segDuration.toFixed(3),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      '-an', // Remove audio, we'll add voiceover
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-y', outputName,
    ]);

    segmentFiles.push(outputName);
    onProgress(40 + i * 7);
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
