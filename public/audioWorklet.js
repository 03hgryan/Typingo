// AudioWorklet for processing tab audio
// Must be plain JavaScript (no imports/TypeScript)

class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Get initial chunk duration from options (default 320ms)
    const chunkDurationSec = options.processorOptions?.chunkDurationSec || 0.32;
    this.setChunkDuration(chunkDurationSec);

    this.buffer = new Float32Array(16000); // Max 1 second buffer
    this.writeIndex = 0;
    this.chunkIndex = 0;

    // Listen for settings changes from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === "SET_CHUNK_DURATION") {
        this.setChunkDuration(event.data.chunkDurationSec);
        console.log(`[AudioWorklet] Chunk duration updated: ${this.chunkDurationMs}ms`);
      }
    };

    console.log(`[AudioWorklet] Initialized: ${this.chunkDurationMs}ms`);
  }

  setChunkDuration(seconds) {
    this.targetSamples = Math.floor(16000 * seconds);
    this.chunkDurationMs = seconds * 1000;
  }

  process(inputs, outputs, parameters) {
    if (!inputs[0] || !inputs[0][0]) {
      return true;
    }

    const left = inputs[0][0];
    const right = inputs[0][1];

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
        this.sendChunk();
      }
    }

    return true;
  }

  sendChunk() {
    // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
    const pcm = new Int16Array(this.writeIndex);
    for (let i = 0; i < this.writeIndex; i++) {
      const clamped = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm[i] = Math.round(clamped * 0x7fff);
    }

    this.port.postMessage(
      {
        pcm: pcm,
        chunk_index: this.chunkIndex++,
        duration_ms: this.chunkDurationMs,
      },
      [pcm.buffer],
    );

    this.writeIndex = 0;
  }
}

registerProcessor("audio-worklet", AudioProcessor);
