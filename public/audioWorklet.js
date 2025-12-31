// AudioWorklet for processing tab audio
// Must be plain JavaScript (no imports/TypeScript)

class AudioWorkletProcessorImpl extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSamples = 16000 * 0.32; // 320ms @ 16kHz
    this.buffer = new Float32Array(this.targetSamples * 2);
    this.writeIndex = 0;
    this.chunkIndex = 0; // Use chunk index instead of currentTime
  }

  process(inputs, outputs, parameters) {
    if (!inputs[0] || !inputs[0][0]) {
      return true;
    }

    const input = inputs[0][0];

    // Downsample 48kHz → 16kHz
    for (let i = 0; i < input.length - 2; i += 3) {
      const sample = (input[i] + input[i + 1] + input[i + 2]) / 3;
      this.buffer[this.writeIndex++] = sample;

      if (this.writeIndex >= this.targetSamples) {
        const pcm16 = this.floatToPCM16(
          this.buffer.subarray(0, this.targetSamples)
        );

        const chunk = {
          pcm: pcm16,
          chunk_index: this.chunkIndex,
          duration_ms: 320,
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
