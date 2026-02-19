// background.ts
import { AudioStreamer } from "./lib/audioStreamer";
import {
  getAsrProvider,
  setAsrProvider,
  getTranslator,
  setTranslator,
  getTargetLang,
  setTargetLang,
  getSourceLang,
  setSourceLang,
  getAggressiveness,
  setAggressiveness,
  getUpdateFrequency,
  setUpdateFrequency,
  getDelayMs,
  setDelayMs,
} from "./lib/settings";
import type { AsrProvider, TranslatorType, TargetLanguage, SourceLanguage } from "./lib/types";

console.log("Background script is running");

let streamer: AudioStreamer | null = null;
let isConnected = false;
let isCapturing = false;
let activeTabId: number | null = null;
let hasOffscreenDocument = false;
let sidePanelOpen = false;

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const WS_BASE_URL = "ws://localhost:8000/stt";
const PRODUCTION_WS_BASE_URL = "wss://fap-486860272818.us-west1.run.app/stt";

function getWsUrl(
  provider: AsrProvider,
  translator: TranslatorType,
  targetLang: string,
  sourceLang: string,
  aggressiveness: number,
  updateFrequency: number,
): string {
  return `${WS_BASE_URL}/${provider}?target_lang=${encodeURIComponent(targetLang)}&source_lang=${encodeURIComponent(sourceLang)}&aggressiveness=${aggressiveness}&update_frequency=${updateFrequency}&translator=${encodeURIComponent(translator)}`;
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

function sendTranslationCaption(confirmed: string, partial: string, speaker?: string, prevConfirmed?: string) {
  if (activeTabId) {
    chrome.tabs
      .sendMessage(activeTabId, {
        type: "SHOW_TRANSLATION_CAPTION",
        confirmed,
        partial,
        speaker,
        prevConfirmed: prevConfirmed || "",
      })
      .catch(() => {});
  }
}

function sendTranscriptCaption(confirmed: string, partial: string, speaker?: string, prevConfirmed?: string) {
  if (activeTabId) {
    chrome.tabs
      .sendMessage(activeTabId, {
        type: "SHOW_TRANSCRIPT_CAPTION",
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

// ============ Per-Speaker State ============

let audioDelayMs = 5000;

interface SpeakerState {
  confirmed: string;
  prev: string;
  partial: string;
  partialStartElapsed: number; // elapsed_ms when current partial sequence began
  awaitingNewPartial: boolean; // true at start and after each confirmation
  transcriptConfirmCount: number; // incremented on each confirmation; partials scheduled before are stale
  deltaGeneration: number; // tracks current partial_translation_delta generation
  deltaAccumulated: string; // accumulated delta text for current generation
}

const speakerTranslation: Record<string, SpeakerState> = {};
const speakerTranscript: Record<string, SpeakerState> = {};

function getSpeakerState(map: Record<string, SpeakerState>, speaker: string): SpeakerState {
  if (!map[speaker])
    map[speaker] = {
      confirmed: "",
      prev: "",
      partial: "",
      partialStartElapsed: -1,
      awaitingNewPartial: true,
      transcriptConfirmCount: 0,
      deltaGeneration: -1,
      deltaAccumulated: "",
    };
  return map[speaker];
}

// ============ Caption Sync ============
// Backend sends elapsed_ms (time since stream started).
// Frontend records streamStartedAt when connected.
// showAt = streamStartedAt + elapsed_ms + audioDelayMs

let streamStartedAt = 0;
const captionTimeouts = new Set<number>();

function scheduleCaption(elapsedMs: number, fn: () => void) {
  const showAt = streamStartedAt + elapsedMs + audioDelayMs;
  const delay = Math.max(0, showAt - Date.now());
  if (delay === 0) {
    fn();
  } else {
    const id = setTimeout(() => {
      captionTimeouts.delete(id);
      fn();
    }, delay);
    captionTimeouts.add(id);
  }
}

function clearCaptionTimeouts() {
  captionTimeouts.forEach((id) => clearTimeout(id));
  captionTimeouts.clear();
}

// ============ WebSocket ============

async function connectWebSocket() {
  if (isConnected) {
    console.log("⚠️ Already connected");
    return;
  }

  clearCaptionTimeouts();
  for (const key of Object.keys(speakerTranslation)) delete speakerTranslation[key];
  for (const key of Object.keys(speakerTranscript)) delete speakerTranscript[key];

  try {
    const provider = await getAsrProvider();
    const translator = await getTranslator();
    const targetLang = await getTargetLang();
    const sourceLang = await getSourceLang();
    const aggressiveness = await getAggressiveness();
    const updateFrequency = await getUpdateFrequency();
    audioDelayMs = await getDelayMs();
    const wsUrl = getWsUrl(provider, translator, targetLang, sourceLang, aggressiveness, updateFrequency);
    console.log(`🔌 Connecting to WebSocket (${provider})...`);
    streamer = new AudioStreamer();

    await streamer.connect(wsUrl, (data) => {
      if (data.type === "session_started") {
        streamStartedAt = Date.now();
      }

      if (data.type === "confirmed_transcript") {
        const speaker = data.speaker || "default";
        const elapsed = data.elapsed_ms || 0;
        const st = getSpeakerState(speakerTranscript, speaker);
        st.prev = st.confirmed;
        st.confirmed = data.text || "";
        st.partial = "";
        st.awaitingNewPartial = true;
        st.transcriptConfirmCount++;
        const { confirmed, prev } = st;
        // Schedule at partialStart (when user starts hearing this in delayed video)
        const scheduleElapsed = st.partialStartElapsed >= 0 ? st.partialStartElapsed : elapsed;
        scheduleCaption(scheduleElapsed, () => {
          chrome.runtime.sendMessage({ type: "CONFIRMED_TRANSCRIPT", speaker, text: confirmed }).catch(() => {});
          sendTranscriptCaption(confirmed, "", speaker, prev);
        });
      }

      if (data.type === "partial_transcript") {
        const speaker = data.speaker || "default";
        const elapsed = data.elapsed_ms || 0;
        const st = getSpeakerState(speakerTranscript, speaker);
        st.partial = data.text || "";
        // Track when a new partial sequence starts
        if (st.awaitingNewPartial) {
          st.partialStartElapsed = elapsed;
          st.awaitingNewPartial = false;
        }
        const { partial } = st;
        const confirmCountAtSchedule = st.transcriptConfirmCount;
        scheduleCaption(elapsed, () => {
          // Skip if a confirmation has happened since this partial was scheduled
          if (st.transcriptConfirmCount !== confirmCountAtSchedule) return;
          sendTranscriptCaption("", partial, speaker);
        });
      }

      if (data.type === "confirmed_translation") {
        const speaker = data.speaker || "default";
        const elapsed = data.elapsed_ms || 0;
        const st = getSpeakerState(speakerTranslation, speaker);
        st.prev = st.confirmed;
        st.confirmed = data.text || "";
        st.partial = "";
        const { confirmed, prev } = st;
        scheduleCaption(elapsed, () => {
          chrome.runtime.sendMessage({ type: "CONFIRMED_TRANSLATION", speaker, text: confirmed }).catch(() => {});
          sendTranslationCaption(confirmed, "", speaker, prev);
        });
      }

      if (data.type === "partial_translation") {
        const speaker = data.speaker || "default";
        const elapsed = data.elapsed_ms || 0;
        const st = getSpeakerState(speakerTranslation, speaker);
        st.partial = data.text || "";
        st.deltaAccumulated = ""; // reset delta accumulation on full partial
        const { confirmed, partial } = st;
        scheduleCaption(elapsed, () => {
          chrome.runtime.sendMessage({ type: "PARTIAL_TRANSLATION", speaker, text: partial }).catch(() => {});
          sendTranslationCaption(confirmed, partial, speaker);
        });
      }

      if (data.type === "partial_translation_delta") {
        const speaker = data.speaker || "default";
        const elapsed = data.elapsed_ms || 0;
        const generation = data.generation ?? -1;
        const delta = data.delta || "";
        const st = getSpeakerState(speakerTranslation, speaker);

        // New generation: reset accumulated delta
        if (generation !== st.deltaGeneration) {
          st.deltaGeneration = generation;
          st.deltaAccumulated = "";
        }
        st.deltaAccumulated += delta;
        st.partial = st.deltaAccumulated;

        const { confirmed, partial } = st;
        scheduleCaption(elapsed, () => {
          chrome.runtime.sendMessage({ type: "PARTIAL_TRANSLATION", speaker, text: partial }).catch(() => {});
          sendTranslationCaption(confirmed, partial, speaker);
        });
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

          chrome.runtime
            .sendMessage({ type: "START_OFFSCREEN_CAPTURE", streamId, delayMs: audioDelayMs })
            .catch(() => {});
          chrome.tabs.sendMessage(tab.id!, { type: "START_VIDEO_DELAY", delayMs: audioDelayMs }).catch(() => {});
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
    clearCaptionTimeouts();
    disconnectWebSocket();
    closeOffscreenDocument();
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: "STOP_VIDEO_DELAY" }).catch(() => {});
    }
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

  if (msg.type === "GET_TRANSLATOR") {
    getTranslator().then((translator) => sendResponse({ translator }));
    return true;
  }

  if (msg.type === "SET_TRANSLATOR") {
    if (isCapturing) {
      sendResponse({ success: false, error: "Cannot change translator while translating" });
      return false;
    }
    setTranslator(msg.translator).then(() => sendResponse({ success: true }));
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

  if (msg.type === "GET_AGGRESSIVENESS") {
    getAggressiveness().then((aggressiveness) => sendResponse({ aggressiveness }));
    return true;
  }

  if (msg.type === "SET_AGGRESSIVENESS") {
    if (isCapturing) {
      sendResponse({ success: false, error: "Cannot change aggressiveness while translating" });
      return false;
    }
    setAggressiveness(msg.aggressiveness).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === "GET_UPDATE_FREQUENCY") {
    getUpdateFrequency().then((updateFrequency) => sendResponse({ updateFrequency }));
    return true;
  }

  if (msg.type === "SET_UPDATE_FREQUENCY") {
    if (isCapturing) {
      sendResponse({ success: false, error: "Cannot change update frequency while translating" });
      return false;
    }
    setUpdateFrequency(msg.updateFrequency).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === "GET_DELAY_MS") {
    getDelayMs().then((delayMs) => sendResponse({ delayMs }));
    return true;
  }

  if (msg.type === "SET_DELAY_MS") {
    if (isCapturing) {
      sendResponse({ success: false, error: "Cannot change delay while translating" });
      return false;
    }
    setDelayMs(msg.delayMs).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === "CLEAR_SESSION") {
    clearCaptionTimeouts();
    for (const key of Object.keys(speakerTranslation)) delete speakerTranslation[key];
    for (const key of Object.keys(speakerTranscript)) delete speakerTranscript[key];
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: "CLEAR_ACCUMULATED" }).catch(() => {});
    }
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === "TOGGLE_SIDE_PANEL") {
    const tabId = msg.tabId;
    if (tabId) {
      if (sidePanelOpen) {
        chrome.sidePanel.close({ tabId });
        sidePanelOpen = false;
      } else {
        chrome.sidePanel.open({ tabId });
        sidePanelOpen = true;
      }
    }
    sendResponse({ success: true });
    return false;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Extension installed");
});
