import { AudioStreamer } from "./stream/audioStreamer";

console.log("Background script is running");

let streamer: AudioStreamer | null = null;
let isConnected = false;

const WS_URL = "ws://localhost:8000/ws/stream";

async function connectWebSocket() {
  if (isConnected) {
    console.log("⚠️ Already connected");
    return;
  }

  try {
    console.log("🔌 Connecting to WebSocket...");
    streamer = new AudioStreamer();

    await streamer.connect(WS_URL, (data) => {
      // Forward segments to popup (distinguish between live and finalized)
      console.log("📦 Received from backend:", data);

      if (data.type === "segments_update") {
        // Live segment (mutable)
        chrome.runtime
          .sendMessage({
            type: "SEGMENTS_UPDATE",
            payload: data,
          })
          .catch((err) => {
            console.log("Popup not available:", err.message);
          });
      } else if (data.type === "segments_finalized") {
        // Finalized segment (immutable)
        chrome.runtime
          .sendMessage({
            type: "SEGMENTS_FINALIZED",
            payload: data,
          })
          .catch((err) => {
            console.log("Popup not available:", err.message);
          });
      }
    });

    isConnected = true;
    console.log("✅ WebSocket connected");

    // Notify popup that connection succeeded
    chrome.runtime.sendMessage({ type: "WS_CONNECTED" }).catch(() => {});
  } catch (error) {
    console.error("❌ Failed to connect WebSocket:", error);
    isConnected = false;
  }
}

function disconnectWebSocket() {
  console.log("🔌 Disconnecting WebSocket...");

  if (streamer && isConnected) {
    streamer.disconnect();
    isConnected = false;
    streamer = null;
    console.log("✅ WebSocket disconnected");

    // Notify popup
    chrome.runtime.sendMessage({ type: "WS_DISCONNECTED" }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CONNECT_WS") {
    connectWebSocket();
  }

  if (msg.type === "DISCONNECT_WS") {
    disconnectWebSocket();
  }

  if (msg.type === "AUDIO_CHUNK") {
    console.log("📨 Received audio chunk from popup");
    // Forward audio chunk to WebSocket
    if (streamer && isConnected) {
      // Convert array back to Int16Array
      const chunk = {
        pcm: new Int16Array(msg.chunk.pcm),
        chunk_index: msg.chunk.chunk_index,
        duration_ms: msg.chunk.duration_ms,
      };
      streamer.send(chunk);
    } else {
      console.warn("⚠️ Received audio chunk but WebSocket not connected");
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Extension installed");
});
