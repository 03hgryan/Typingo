// audioCapture.ts - Tab audio capture
import type { AudioChunk } from "./types";

export class AudioCapture {
  private ctx?: AudioContext;
  private workletNode?: AudioWorkletNode;
  private stream?: MediaStream;

  constructor(private onChunk: (chunk: AudioChunk) => void) {}

  async start(chunkDurationSec: number): Promise<void> {
    // Clean up if already running
    this.stop();

    console.log(`🎤 Starting capture (${chunkDurationSec * 1000}ms chunks)`);

    // Capture tab audio
    this.stream = await this.captureTabAudio();

    // Set up audio processing pipeline
    this.ctx = new AudioContext({ sampleRate: 48000 });
    await this.ctx.audioWorklet.addModule(chrome.runtime.getURL("audioWorklet.js"));

    const source = this.ctx.createMediaStreamSource(this.stream);

    this.workletNode = new AudioWorkletNode(this.ctx, "audio-worklet", {
      processorOptions: { chunkDurationSec },
    });

    this.workletNode.port.onmessage = (e) => {
      this.onChunk(e.data as AudioChunk);
    };

    // Connect: source → worklet (processing) and source → speakers (playback)
    source.connect(this.workletNode);
    source.connect(this.ctx.destination);

    console.log("🎤 Audio capture started");
  }

  stop(): void {
    this.workletNode?.disconnect();
    this.workletNode = undefined;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;

    this.ctx?.close();
    this.ctx = undefined;

    console.log("🎤 Audio capture stopped");
  }

  updateChunkDuration(seconds: number): void {
    this.workletNode?.port.postMessage({
      type: "SET_CHUNK_DURATION",
      chunkDurationSec: seconds,
    });
    console.log(`⚙️ Chunk duration updated: ${seconds * 1000}ms`);
  }

  get isCapturing(): boolean {
    return !!this.stream?.active;
  }

  private captureTabAudio(): Promise<MediaStream> {
    return new Promise<MediaStream>((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (stream) {
          resolve(stream);
        } else {
          reject(new Error("Failed to capture tab audio"));
        }
      });
    });
  }
}
