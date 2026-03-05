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

  // Write all clip files
  for (let i = 0; i < clips.length; i++) {
    await ff.writeFile(`clip${i}.mp4`, await fetchFile(clips[i].file));
    onProgress(15 + (i + 1) * 3);
  }

  // For each segment, extract multiple trimmed ranges, concat them, then speed-adjust
  const segmentFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segDuration = seg.endTime - seg.startTime;
    const clip = clips[i];
    const ranges = clip.trimRanges;

    // Extract each range as a separate file
    const rangeParts: string[] = [];
    for (let r = 0; r < ranges.length; r++) {
      const range = ranges[r];
      const partName = `seg${i}_part${r}.mp4`;
      const partDuration = range.end - range.start;

      await ff.exec([
        '-ss', range.start.toFixed(3),
        '-i', `clip${i}.mp4`,
        '-t', partDuration.toFixed(3),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-y', partName,
      ]);
      rangeParts.push(partName);
    }

    // Concat the range parts if multiple
    let concatenatedFile: string;
    if (rangeParts.length === 1) {
      concatenatedFile = rangeParts[0];
    } else {
      const concatList = rangeParts.map(f => `file '${f}'`).join('\n');
      await ff.writeFile(`seg${i}_concat.txt`, concatList);
      concatenatedFile = `seg${i}_concat.mp4`;
      await ff.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', `seg${i}_concat.txt`,
        '-c', 'copy',
        '-y', concatenatedFile,
      ]);
    }

    // Calculate total selected duration and speed factor
    const totalSelected = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
    const speedFactor = totalSelected / segDuration;
    const outputName = `seg${i}.mp4`;

    if (Math.abs(speedFactor - 1) < 0.05) {
      // Close enough, just rename/copy
      await ff.exec([
        '-i', concatenatedFile,
        '-c', 'copy',
        '-y', outputName,
      ]);
    } else {
      // Speed adjust using setpts
      const setptsValue = (1 / speedFactor).toFixed(4);
      await ff.exec([
        '-i', concatenatedFile,
        '-vf', `setpts=${setptsValue}*PTS`,
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-y', outputName,
      ]);
    }

    segmentFiles.push(outputName);
    onProgress(36 + i * 7);
  }

  // Create final concat file
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
