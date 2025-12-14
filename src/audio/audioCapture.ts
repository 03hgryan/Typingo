import type { AudioChunk } from "./types";

// Re-export AudioChunk for convenience
export type { AudioChunk };

export class AudioCapture {
  private ctx?: AudioContext;
  private workletNode?: AudioWorkletNode;
  private stream?: MediaStream;

  constructor(private onChunk: (chunk: AudioChunk) => void) {}

  async start() {
    // Clean up existing resources before starting new capture
    if (this.ctx || this.stream || this.workletNode) {
      this.stop();
    }

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

    await this.ctx.audioWorklet.addModule(chrome.runtime.getURL("audio/audioWorklet.js"));

    const source = this.ctx.createMediaStreamSource(this.stream);

    this.workletNode = new AudioWorkletNode(this.ctx, "audio-worklet");

    this.workletNode.port.onmessage = (e) => {
      this.onChunk(e.data as AudioChunk);
    };

    source.connect(this.workletNode);
  }

  stop() {
    // Disconnect and clean up worklet node
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = undefined;
    }

    // Stop all media stream tracks
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;

    // Close audio context
    this.ctx?.close();
    this.ctx = undefined;
  }
}
