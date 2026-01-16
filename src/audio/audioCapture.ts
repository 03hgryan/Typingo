// audioCapture.ts
import type { AudioChunk } from "./types";

export class AudioCapture {
  private ctx?: AudioContext;
  private workletNode?: AudioWorkletNode;
  private stream?: MediaStream;

  constructor(private onChunk: (chunk: AudioChunk) => void) {}

  async start() {
    // Clean up existing resources
    if (this.ctx || this.stream || this.workletNode) {
      this.stop();
    }

    // Capture tab audio (must be called from popup/foreground context)
    this.stream = await new Promise<MediaStream>((resolve, reject) => {
      chrome.tabCapture.capture(
        {
          audio: true,
          video: false,
        },
        (stream) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (stream) {
            resolve(stream);
          } else {
            reject(new Error("Failed to capture tab audio: stream is null"));
          }
        }
      );
    });

    this.ctx = new AudioContext({ sampleRate: 48000 });

    // Load audioWorklet from public folder
    await this.ctx.audioWorklet.addModule(chrome.runtime.getURL("public/audioWorklet.js"));

    const source = this.ctx.createMediaStreamSource(this.stream);

    this.workletNode = new AudioWorkletNode(this.ctx, "audio-worklet");

    this.workletNode.port.onmessage = (e) => {
      this.onChunk(e.data as AudioChunk);
    };

    // Connect to worklet for processing
    source.connect(this.workletNode);

    // ALSO connect to speakers so audio isn't muted
    source.connect(this.ctx.destination);
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = undefined;
    }

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;

    this.ctx?.close();
    this.ctx = undefined;
  }
}
