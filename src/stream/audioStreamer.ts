import type { AudioChunk } from "../audio/types";

export class AudioStreamer {
  private ws?: WebSocket;

  async connect(url: string) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    await new Promise((res) => {
      this.ws!.onopen = res;
    });
  }

  send(chunk: AudioChunk) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Binary framing: Send metadata as JSON, then PCM as binary
    // Server should expect this two-message protocol per chunk

    // 1. Send metadata (small, JSON is fine here)
    this.ws.send(
      JSON.stringify({
        type: "audio_chunk",
        start_time_ms: chunk.start_time_ms,
        duration_ms: chunk.duration_ms,
        pcm_length: chunk.pcm.length,
      })
    );

    // 2. Send raw PCM binary data (much more efficient than JSON array)
    this.ws.send(chunk.pcm.buffer);
  }
}
