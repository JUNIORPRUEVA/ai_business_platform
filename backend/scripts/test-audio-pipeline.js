const { spawn, spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync } = require('node:fs');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { extname, join, resolve } = require('node:path');

const inputArg = process.argv[2] || '/tmp/audio-input.ogg';
const inputPath = resolve(inputArg);
const apiKey = process.env.OPENAI_API_KEY || '';
const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

function resolveFfmpegExecutable() {
  const systemProbe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
  if (systemProbe.status === 0) {
    return 'ffmpeg';
  }

  try {
    const bundled = require('ffmpeg-static');
    if (bundled && existsSync(bundled)) {
      return bundled;
    }
  } catch {
    // ignore
  }

  throw new Error('FFMPEG NOT INSTALLED - AUDIO PROCESSING DISABLED');
}

function runFfmpeg(executable, inputFile, outputFile) {
  return new Promise((resolvePromise, rejectPromise) => {
    let stderr = '';
    const child = spawn(
      executable,
      ['-y', '-i', inputFile, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputFile],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    );

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(stderr);
        return;
      }
      rejectPromise(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

async function transcribeAudio(buffer) {
  if (!apiKey) {
    console.log('TRANSCRIPTION SKIPPED - OPENAI_API_KEY missing');
    return null;
  }

  const form = new FormData();
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('file', new Blob([Uint8Array.from(buffer)], { type: 'audio/wav' }), 'output.wav');

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`transcription_failed_${response.status}:${await response.text()}`);
  }

  return response.json();
}

async function main() {
  console.log(`AUDIO FILE PATH: ${inputPath}`);
  if (!existsSync(inputPath)) {
    throw new Error('AUDIO FILE NOT FOUND - DOWNLOAD FAILED');
  }

  const ffmpeg = resolveFfmpegExecutable();
  console.log(`FFMPEG: ${ffmpeg}`);
  console.log('AUDIO RECEIVED');

  const tempDir = mkdtempSync(join(tmpdir(), 'botposvendedor-audio-manual-'));
  const outputPath = join(tempDir, 'output.wav');

  try {
    console.log('TRANSCODE START');
    const stderr = await runFfmpeg(ffmpeg, inputPath, outputPath);
    if (!existsSync(outputPath)) {
      throw new Error('AUDIO FILE NOT FOUND - DOWNLOAD FAILED');
    }

    const outputBuffer = readFileSync(outputPath);
    console.log(`AUDIO CONVERTED size=${outputBuffer.length} format=wav`);
    if (stderr.trim()) {
      console.log(`FFMPEG STDERR: ${stderr.trim().slice(0, 800)}`);
    }

    console.log('TRANSCRIPTION START');
    const transcript = await transcribeAudio(outputBuffer);
    if (transcript) {
      console.log(`TRANSCRIPTION RESULT: ${(transcript.text || '').slice(0, 500)}`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
