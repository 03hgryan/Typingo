// background.ts
import { AudioStreamer } from "./lib/audioStreamer";
import {
  getAsrProvider,
  setAsrProvider,
  getTargetLang,
  setTargetLang,
  getSourceLang,
  setSourceLang,
} from "./lib/settings";
import type { AsrProvider, TargetLanguage, SourceLanguage } from "./lib/types";

console.log("Background script is running");

let streamer: AudioStreamer | null = null;
let isConnected = false;
let isCapturing = false;
let activeTabId: number | null = null;
let hasOffscreenDocument = false;

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const WS_BASE_URL = "ws://localhost:8000/stt";
const PRODUCTION_WS_BASE_URL = "wss://fap-486860272818.us-west1.run.app/stt";

function getWsUrl(provider: AsrProvider, targetLang: string, sourceLang: string): string {
  return `${WS_BASE_URL}/${provider}?target_lang=${encodeURIComponent(targetLang)}&source_lang=${encodeURIComponent(sourceLang)}`;
}

// ============ Offscreen Document ============

async function createOffscreenDocument() {
  if (hasOffscreenDocument) return;

  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Audio capture for speech-to-text translation",
    });
    hasOffscreenDocument = true;
    console.log("Offscreen document created");
  } catch (error) {
    if (String(error).includes("single offscreen document")) {
      hasOffscreenDocument = true;
    } else {
      console.error("Failed to create offscreen document:", error);
      throw error;
    }
  }
}

async function closeOffscreenDocument() {
  if (!hasOffscreenDocument) return;

  try {
    await chrome.offscreen.closeDocument();
    hasOffscreenDocument = false;
    console.log("Offscreen document closed");
  } catch (error) {
    console.error("Failed to close offscreen document:", error);
  }
}

// ============ Caption Helpers ============

function sendCaptionToTab(confirmed: string, partial: string, speaker?: string, prevConfirmed?: string) {
  if (activeTabId) {
    chrome.tabs
      .sendMessage(activeTabId, {
        type: "SHOW_CAPTION",
        confirmed,
        partial,
        speaker,
        prevConfirmed: prevConfirmed || "",
      })
      .catch(() => {});
  }
}

function removeCaptionFromTab() {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: "REMOVE_CAPTION" }).catch(() => {});
  }
}

// ============ State ============

let confirmedTranslation = "";
let prevConfirmedTranslation = "";
let accumulatedConfirmedTranslation = "";
let partialTranslation = "";

// ============ WebSocket ============

async function connectWebSocket() {
  if (isConnected) {
    console.log("⚠️ Already connected");
    return;
  }

  confirmedTranslation = "";
  prevConfirmedTranslation = "";
  accumulatedConfirmedTranslation = "";
  partialTranslation = "";

  try {
    const provider = await getAsrProvider();
    const targetLang = await getTargetLang();
    const sourceLang = await getSourceLang();
    const wsUrl = getWsUrl(provider, targetLang, sourceLang);
    console.log(`🔌 Connecting to WebSocket (${provider})...`);
    streamer = new AudioStreamer();

    await streamer.connect(wsUrl, (data) => {
      if (data.type === "confirmed_translation") {
        prevConfirmedTranslation = confirmedTranslation;
        confirmedTranslation = data.text || "";
        accumulatedConfirmedTranslation = accumulatedConfirmedTranslation
          ? accumulatedConfirmedTranslation + " " + confirmedTranslation
          : confirmedTranslation;
        partialTranslation = "";
        chrome.runtime.sendMessage({ type: "CONFIRMED_TRANSLATION", text: confirmedTranslation }).catch(() => {});
        sendCaptionToTab(confirmedTranslation, "", data.speaker, prevConfirmedTranslation);
      }

      if (data.type === "partial_translation") {
        partialTranslation = data.text || "";
        chrome.runtime.sendMessage({ type: "PARTIAL_TRANSLATION", text: partialTranslation }).catch(() => {});
        sendCaptionToTab(confirmedTranslation, partialTranslation, data.speaker);
      }

      if (data.type === "partial") {
        chrome.runtime.sendMessage({ type: "TRANSCRIPT", text: data.text || "" }).catch(() => {});
      }

      if (data.type === "error") {
        chrome.runtime
          .sendMessage({
            type: "ERROR",
            message: data.message || "Server error",
          })
          .catch(() => {});
      }
    });

    isConnected = true;
    console.log("✅ WebSocket connected");
    chrome.runtime.sendMessage({ type: "WS_CONNECTED" }).catch(() => {});
  } catch (error) {
    console.error("❌ Failed to connect:", error);
    isConnected = false;
    chrome.runtime.sendMessage({ type: "WS_ERROR", error: String(error) }).catch(() => {});
    throw error;
  }
}

function disconnectWebSocket() {
  console.log("🔌 Disconnecting...");

  if (streamer && isConnected) {
    streamer.disconnect();
    isConnected = false;
    streamer = null;
    console.log("✅ Disconnected");
    chrome.runtime.sendMessage({ type: "WS_DISCONNECTED" }).catch(() => {});
  }
}

// ============ Message Handler ============

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START_CAPTURE") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ success: false, error: "No active tab" });
        return;
      }

      activeTabId = tab.id;

      try {
        await connectWebSocket();
        await createOffscreenDocument();

        chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
          if (chrome.runtime.lastError) {
            console.error("Tab capture error:", chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          isCapturing = true;

          chrome.runtime.sendMessage({ type: "START_OFFSCREEN_CAPTURE", streamId }).catch(() => {});
          chrome.runtime.sendMessage({ type: "CAPTURE_STARTED" }).catch(() => {});

          sendResponse({ success: true });
        });
      } catch (error) {
        console.error("Start capture error:", error);
        sendResponse({ success: false, error: String(error) });
      }
    });

    return true;
  }

  if (msg.type === "STOP_CAPTURE") {
    chrome.runtime.sendMessage({ type: "STOP_OFFSCREEN_CAPTURE" }).catch(() => {});
    isCapturing = false;
    disconnectWebSocket();
    closeOffscreenDocument();
    removeCaptionFromTab();
    activeTabId = null;
    chrome.runtime.sendMessage({ type: "CAPTURE_STOPPED" }).catch(() => {});
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === "AUDIO_CHUNK") {
    if (streamer && isConnected) {
      const chunk = {
        pcm: new Int16Array(msg.chunk.pcm),
        chunk_index: msg.chunk.chunk_index,
        duration_ms: msg.chunk.duration_ms,
      };
      streamer.send(chunk);
    }
    return false;
  }

  if (msg.type === "OFFSCREEN_CAPTURE_STARTED") {
    console.log("Offscreen capture started");
    return false;
  }

  if (msg.type === "OFFSCREEN_CAPTURE_STOPPED") {
    console.log("Offscreen capture stopped");
    return false;
  }

  if (msg.type === "OFFSCREEN_CAPTURE_ERROR") {
    console.error("Offscreen capture error:", msg.error);
    isCapturing = false;
    chrome.runtime.sendMessage({ type: "CAPTURE_ERROR", error: msg.error }).catch(() => {});
    return false;
  }

  if (msg.type === "GET_CAPTURE_STATE") {
    sendResponse({ isCapturing });
    return false;
  }

  if (msg.type === "GET_ASR_PROVIDER") {
    getAsrProvider().then((provider) => sendResponse({ provider }));
    return true;
  }

  if (msg.type === "SET_ASR_PROVIDER") {
    if (isCapturing) {
      sendResponse({ success: false, error: "Cannot change provider while translating" });
      return false;
    }
    setAsrProvider(msg.provider).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === "GET_TARGET_LANG") {
    getTargetLang().then((lang) => sendResponse({ lang }));
    return true;
  }

  if (msg.type === "SET_TARGET_LANG") {
    if (isCapturing) {
      sendResponse({ success: false, error: "Cannot change language while translating" });
      return false;
    }
    setTargetLang(msg.lang).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === "GET_SOURCE_LANG") {
    getSourceLang().then((lang) => sendResponse({ lang }));
    return true;
  }

  if (msg.type === "SET_SOURCE_LANG") {
    if (isCapturing) {
      sendResponse({ success: false, error: "Cannot change language while translating" });
      return false;
    }
    setSourceLang(msg.lang).then(() => sendResponse({ success: true }));
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Extension installed");
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
