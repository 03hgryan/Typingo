// AudioWorklet for processing tab audio
// Must be plain JavaScript (no imports/TypeScript)

class AudioWorkletProcessorImpl extends AudioWorkletProcessor {
  constructor() {
    super();

    // ============ CONFIGURATION ============
    // Change this value to adjust chunk duration:
    // 0.1 = 100ms (more responsive, more messages)
    // 0.32 = 320ms (less overhead, higher latency)
    const CHUNK_DURATION_SEC = 0.32;
    // =======================================

    this.targetSamples = 16000 * CHUNK_DURATION_SEC;
    this.chunkDurationMs = CHUNK_DURATION_SEC * 1000;
    this.buffer = new Float32Array(this.targetSamples * 2);
    this.writeIndex = 0;
    this.chunkIndex = 0;
  }

  process(inputs, outputs, parameters) {
    if (!inputs[0] || !inputs[0][0]) {
      return true;
    }

    const left = inputs[0][0];
    const right = inputs[0][1]; // May be undefined if mono

    // Downsample 48kHz → 16kHz (average every 3 samples)
    for (let i = 0; i < left.length - 2; i += 3) {
      let sample;

      if (right) {
        // Stereo: mix L+R to mono, then average 3 samples
        const mono0 = (left[i] + right[i]) / 2;
        const mono1 = (left[i + 1] + right[i + 1]) / 2;
        const mono2 = (left[i + 2] + right[i + 2]) / 2;
        sample = (mono0 + mono1 + mono2) / 3;
      } else {
        // Mono: just average 3 samples
        sample = (left[i] + left[i + 1] + left[i + 2]) / 3;
      }

      this.buffer[this.writeIndex++] = sample;

      if (this.writeIndex >= this.targetSamples) {
        const pcm16 = this.floatToPCM16(this.buffer.subarray(0, this.targetSamples));

        const chunk = {
          pcm: pcm16,
          chunk_index: this.chunkIndex,
          duration_ms: this.chunkDurationMs,
        };

        this.port.postMessage(chunk, [pcm16.buffer]);

        this.chunkIndex++;
        this.writeIndex = 0;
      }
    }

    return true;
  }

  floatToPCM16(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32[i]));
      out[i] = Math.round(clamped * 0x7fff);
    }
    return out;
  }
}

registerProcessor("audio-worklet", AudioWorkletProcessorImpl);
