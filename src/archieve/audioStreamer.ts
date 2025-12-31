import type { AudioChunk } from "../audio/types";

export class AudioStreamer {
  private ws?: WebSocket;
  private onMessage?: (data: any) => void;

  async connect(url: string, onMessage?: (data: any) => void) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.onMessage = onMessage;

    // Handle incoming messages from server
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 Received from server:", data);

        if (this.onMessage) {
          this.onMessage(data);
        }
      } catch (error) {
        console.error("Failed to parse server message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("🔌 WebSocket closed");
    };

    await new Promise((res) => {
      this.ws!.onopen = res;
    });

    console.log("✅ WebSocket connected to", url);
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

  disconnect() {
    if (this.ws) {
      console.log("🔌 Closing WebSocket connection...");
      this.ws.close();
      this.ws = undefined;
    }
  }
}
