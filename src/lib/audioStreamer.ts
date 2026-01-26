// audioStreamer.ts - WebSocket client for audio streaming
import type { AudioChunk, WebSocketMessage } from "./types";

type MessageHandler = (data: WebSocketMessage) => void;

export class AudioStreamer {
  private ws?: WebSocket;
  private onMessage?: MessageHandler;

  async connect(url: string, onMessage?: MessageHandler): Promise<void> {
    // Clean up existing connection
    if (this.ws) {
      this.ws.close();
    }

    this.onMessage = onMessage;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeoutId);
      };

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          reject(new Error("Connection timeout"));
        }
      }, 5000);

      ws.onopen = () => {
        if (!settled) {
          settled = true;
          cleanup();
          this.ws = ws;
          console.log("✅ WebSocket connected to", url);
          resolve();
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error("WebSocket connection failed"));
        }
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket closed");
        this.ws = undefined;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Received:", data);
          this.onMessage?.(data);
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      };
    });
  }

  send(chunk: AudioChunk): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "audio_chunk",
        audio_base_64: this.int16ArrayToBase64(chunk.pcm),
        chunk_index: chunk.chunk_index,
        duration_ms: chunk.duration_ms,
      }),
    );
  }

  disconnect(): void {
    if (!this.ws) return;

    if (this.ws.readyState === WebSocket.OPEN) {
      console.log("🏁 Sending end_stream...");
      this.ws.send(JSON.stringify({ type: "end_stream" }));

      // Give server time to process before closing
      setTimeout(() => {
        this.ws?.close();
        this.ws = undefined;
      }, 500);
    } else {
      this.ws.close();
      this.ws = undefined;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private int16ArrayToBase64(int16Array: Int16Array): string {
    const bytes = new Uint8Array(int16Array.buffer);
    // More efficient than string concatenation
    const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binaryString);
  }
}
