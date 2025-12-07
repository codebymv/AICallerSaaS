// ============================================
// Audio Utilities - Format Conversion
// ============================================

/**
 * Convert PCM audio to mu-law (required by Twilio)
 * Assumes input is 16kHz 16-bit PCM, outputs 8kHz mulaw
 */
export function pcmToMulaw(pcmData: Buffer): Buffer {
  // Downsample from 16kHz to 8kHz by taking every other sample
  const sampleCount = Math.floor(pcmData.length / 4); // 16-bit samples, downsampled by 2
  const mulawData = Buffer.alloc(sampleCount);
  
  for (let i = 0; i < sampleCount; i++) {
    // Read every other 16-bit PCM sample (16kHz -> 8kHz decimation)
    const sample = pcmData.readInt16LE(i * 4); // Skip every other sample
    // Convert to mu-law
    mulawData[i] = linearToMulaw(sample);
  }
  
  return mulawData;
}

/**
 * Convert mu-law audio to PCM
 */
export function mulawToPcm(mulawData: Buffer): Buffer {
  const pcmData = Buffer.alloc(mulawData.length * 2);
  
  for (let i = 0; i < mulawData.length; i++) {
    const sample = mulawToLinear(mulawData[i]);
    pcmData.writeInt16LE(sample, i * 2);
  }
  
  return pcmData;
}

// mu-law encoding table
const MULAW_MAX = 0x1FFF;
const MULAW_BIAS = 33;

function linearToMulaw(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  if (sign) sample = -sample;
  
  sample = Math.min(sample + MULAW_BIAS, MULAW_MAX);
  
  let exponent = 7;
  let mask = 0x1000;
  
  for (; exponent > 0; exponent--, mask >>= 1) {
    if (sample >= mask) break;
  }
  
  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  const compressedByte = ~(sign | (exponent << 4) | mantissa);
  
  return compressedByte & 0xFF;
}

function mulawToLinear(mulawByte: number): number {
  mulawByte = ~mulawByte;
  
  const sign = (mulawByte & 0x80) !== 0;
  const exponent = (mulawByte >> 4) & 0x07;
  const mantissa = mulawByte & 0x0F;
  
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  
  return sign ? -sample : sample;
}

/**
 * Calculate audio duration from buffer (assuming 8kHz mono mu-law)
 */
export function calculateAudioDuration(audioBuffer: Buffer, sampleRate = 8000): number {
  return audioBuffer.length / sampleRate;
}

/**
 * Chunk audio buffer into smaller pieces for streaming
 */
export function chunkAudio(
  audioBuffer: Buffer,
  chunkSize: number = 160 // 20ms at 8kHz
): Buffer[] {
  const chunks: Buffer[] = [];
  
  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    chunks.push(audioBuffer.subarray(i, Math.min(i + chunkSize, audioBuffer.length)));
  }
  
  return chunks;
}

/**
 * Base64 encode audio for Twilio
 */
export function encodeForTwilio(audioBuffer: Buffer): string {
  return audioBuffer.toString('base64');
}

/**
 * Decode base64 audio from Twilio
 */
export function decodeFromTwilio(base64Audio: string): Buffer {
  return Buffer.from(base64Audio, 'base64');
}
