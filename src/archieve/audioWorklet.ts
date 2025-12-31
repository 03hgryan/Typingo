import type { AudioChunk } from "./types";

// Type declarations for AudioWorkletProcessor (not in standard TS libs)
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: typeof AudioWorkletProcessor
): void;

declare const currentTime: number; // AudioWorklet global, in seconds

class AudioWorkletProcessorImpl extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private writeIndex: number;
  private targetSamples: number;
  private startTime: number;

  constructor() {
    super();
    this.targetSamples = 16000 * 0.32; // 320ms @ 16kHz
    this.buffer = new Float32Array(this.targetSamples * 2); // 2x for safety
    this.writeIndex = 0;
    this.startTime = currentTime * 1000; // Audio-clock aligned, in ms
  }

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    // Validate input exists
    if (!inputs[0] || !inputs[0][0]) {
      return true;
    }

    const input = inputs[0][0];

    // Downsample 48kHz → 16kHz with simple box filter
    for (let i = 0; i < input.length - 2; i += 3) {
      // Box filter: average 3 samples before downsampling
      const sample = (input[i] + input[i + 1] + input[i + 2]) / 3;
      this.buffer[this.writeIndex++] = sample;

      if (this.writeIndex >= this.targetSamples) {
        // Create chunk from filled buffer
        const pcm16 = this.floatToPCM16(
          this.buffer.subarray(0, this.targetSamples)
        );

        const chunk: AudioChunk = {
          pcm: pcm16,
          start_time_ms: this.startTime,
          duration_ms: 320,
        };

        // Transfer the buffer for better performance
        this.port.postMessage(chunk, [pcm16.buffer]);

        this.startTime += 320;
        this.writeIndex = 0;
      }
    }

    return true;
  }

  private floatToPCM16(float32: Float32Array): Int16Array {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit PCM
      const clamped = Math.max(-1, Math.min(1, float32[i]));
      out[i] = Math.round(clamped * 0x7fff);
    }
    return out;
  }
}

registerProcessor("audio-worklet", AudioWorkletProcessorImpl);
