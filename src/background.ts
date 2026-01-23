// background.ts
import { AudioStreamer } from "./stream/audioStreamer";

console.log("Background script is running");

let streamer: AudioStreamer | null = null;
let isConnected = false;
let isCapturing = false;
let activeTabId: number | null = null;

// Helper to send caption to content script
function sendCaptionToTab(source: string, translated: string, isStreaming: boolean) {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      type: "SHOW_CAPTION",
      source,
      translated,
      isStreaming,
    }).catch(() => {});
  }
}

function hideCaptionOnTab(delay: number = 3000) {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      type: "HIDE_CAPTION",
      delay,
    }).catch(() => {});
  }
}

function removeCaptionFromTab() {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      type: "REMOVE_CAPTION",
    }).catch(() => {});
  }
}

const WS_URL = "ws://localhost:8000/stt/elevenlabs";

async function connectWebSocket() {
  if (isConnected) {
    console.log("⚠️ Already connected");
    return;
  }

  try {
    console.log("🔌 Connecting to WebSocket...");
    streamer = new AudioStreamer();

    await streamer.connect(WS_URL, (data) => {
      // Forward messages to side panel
      console.log("📦 Received from backend:", data);

      if (data.type === "segments_update") {
        // Live segment (mutable)
        chrome.runtime
          .sendMessage({
            type: "SEGMENTS_UPDATE",
            payload: data,
          })
          .catch((err) => {
            console.log("Side panel not available:", err.message);
          });
      } else if (data.type === "segments_finalized") {
        // Finalized segment (immutable)
        chrome.runtime
          .sendMessage({
            type: "SEGMENTS_FINALIZED",
            payload: data,
          })
          .catch((err) => {
            console.log("Side panel not available:", err.message);
          });
      } else if (data.type === "transcript_final") {
        // Final transcript (on stream end)
        chrome.runtime
          .sendMessage({
            type: "TRANSCRIPT_FINAL",
            payload: data,
          })
          .catch((err) => {
            console.log("Side panel not available:", err.message);
          });
      } else if (data.type === "translation_delta") {
        // Streaming translation chunk
        chrome.runtime
          .sendMessage({
            type: "TRANSLATION_DELTA",
            payload: data.data,
          })
          .catch((err) => {
            console.log("Side panel not available:", err.message);
          });

        // Send caption to content script
        sendCaptionToTab(data.data.source || "", data.data.translated || "", true);
      } else if (data.type === "translation_complete") {
        // Final translation
        chrome.runtime
          .sendMessage({
            type: "TRANSLATION_COMPLETE",
            payload: data.data,
          })
          .catch((err) => {
            console.log("Side panel not available:", err.message);
          });

        // Send final caption and schedule hide
        sendCaptionToTab(data.data.source || "", data.data.translated || "", false);
        hideCaptionOnTab(5000); // Hide after 5 seconds
      } else if (data.type === "translation_error") {
        // Translation error
        chrome.runtime
          .sendMessage({
            type: "TRANSLATION_ERROR",
            payload: data.data,
          })
          .catch((err) => {
            console.log("Side panel not available:", err.message);
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CONNECT_WS") {
    connectWebSocket();
    return false;
  }

  if (msg.type === "DISCONNECT_WS") {
    disconnectWebSocket();
    return false;
  }

  if (msg.type === "AUDIO_CHUNK") {
    // Forward audio chunk to WebSocket (no logging to reduce noise)
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
    return false;
  }

  if (msg.type === "START_CAPTURE") {
    // Get the active tab and start capture
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ success: false, error: "No active tab" });
        return;
      }

      // Store active tab ID for caption injection
      activeTabId = tab.id;

      try {
        // Connect WebSocket first
        await connectWebSocket();

        // Get media stream ID for tab capture
        chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
          if (chrome.runtime.lastError) {
            console.error("Tab capture error:", chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }

          isCapturing = true;

          // Send stream ID to side panel to start audio capture
          chrome.runtime.sendMessage({
            type: "START_CAPTURE_WITH_STREAM_ID",
            streamId,
          }).catch(() => {});

          sendResponse({ success: true });
        });
      } catch (error) {
        console.error("Start capture error:", error);
        sendResponse({ success: false, error: String(error) });
      }
    });

    return true; // Keep channel open for async response
  }

  if (msg.type === "STOP_CAPTURE") {
    isCapturing = false;
    disconnectWebSocket();

    // Remove caption overlay from tab
    removeCaptionFromTab();
    activeTabId = null;

    chrome.runtime.sendMessage({ type: "CAPTURE_STOPPED" }).catch(() => {});
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === "GET_CAPTURE_STATE") {
    sendResponse({ isCapturing });
    return false;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Extension installed");
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
