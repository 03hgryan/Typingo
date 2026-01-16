// audioStreamer.ts
export class AudioStreamer {
  private ws?: WebSocket;
  private onMessage?: (data: any) => void;

  async connect(url: string, onMessage?: (data: any) => void) {
    this.ws = new WebSocket(url);
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

    await new Promise((resolve) => {
      this.ws!.onopen = resolve;
    });

    console.log("✅ WebSocket connected to", url);
  }

  send(chunk: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Send metadata first (for sequencing)
    this.ws.send(
      JSON.stringify({
        type: "audio_chunk",
        chunk_index: chunk.chunk_index,
        duration_ms: chunk.duration_ms,
      })
    );

    // Then send binary PCM data
    this.ws.send(chunk.pcm.buffer);
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("🔌 Sending end_stream signal...");

      // Send end_stream signal before closing (client-driven finalization)
      this.ws.send(JSON.stringify({ type: "end_stream" }));

      // Give server time to finalize
      setTimeout(() => {
        if (this.ws) {
          console.log("🔌 Closing WebSocket connection...");
          this.ws.close();
          this.ws = undefined;
        }
      }, 100);
    } else if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }
}
