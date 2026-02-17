// content.ts
import { VideoDelayer } from "./lib/videoDelay";

console.log("Content script loaded");

const videoDelayer = new VideoDelayer();

// ─── Caption Overlay ───

const FADE_TIMEOUT_MS = 6_000;
const SPEAKER_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#facc15", "#a78bfa"];

interface SpeakerCaption {
  container: HTMLDivElement;
  transcriptEl: HTMLDivElement;
  translationEl: HTMLDivElement;
  fadeTimeout: number | null;
  currentTranscript: string;
  currentTranslation: string;
  displayConfirmedTranslation: string;
  displayPartialTranslation: string;
  accumulatedTranslation: string;
  partialTranslation: string;
  colorIndex: number;
}

let wrapper: HTMLDivElement | null = null;
const speakers: Record<string, SpeakerCaption> = {};
let speakerCount = 0;

function ensureWrapper() {
  if (wrapper) return;
  wrapper = document.createElement("div");
  wrapper.id = "ast-caption-wrapper";
  wrapper.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    width: 80%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  document.body.appendChild(wrapper);
}

function ensureSpeaker(speakerId: string): SpeakerCaption {
  if (speakers[speakerId]) return speakers[speakerId];

  ensureWrapper();

  const colorIndex = speakerCount % SPEAKER_COLORS.length;
  speakerCount++;

  const container = document.createElement("div");
  container.style.cssText = `
    opacity: 0;
    transition: opacity 0.25s ease;
  `;

  const transcriptEl = document.createElement("div");
  transcriptEl.style.cssText = `
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.7);
    font: 400 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 4px 24px;
    border-radius: 6px 6px 0 0;
    text-align: center;
    word-break: keep-all;
  `;

  const translationEl = document.createElement("div");
  translationEl.style.cssText = `
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font: 500 20px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 8px 24px;
    border-radius: 0 0 6px 6px;
    text-align: left;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    word-break: keep-all;
    max-height: 90px;
    overflow-y: auto;
    pointer-events: auto;
  `;

  container.appendChild(transcriptEl);
  container.appendChild(translationEl);
  wrapper!.appendChild(container);

  const state: SpeakerCaption = {
    container,
    transcriptEl,
    translationEl,
    fadeTimeout: null,
    currentTranscript: "",
    currentTranslation: "",
    displayConfirmedTranslation: "",
    displayPartialTranslation: "",
    accumulatedTranslation: "",
    partialTranslation: "",
    colorIndex,
  };
  speakers[speakerId] = state;
  return state;
}

function updateSpeakerCaption(s: SpeakerCaption) {
  if (!s.currentTranscript && !s.currentTranslation) {
    hideSpeakerCaption(s);
    return;
  }

  s.transcriptEl.textContent = s.currentTranscript;
  s.transcriptEl.style.display = s.currentTranscript ? "block" : "none";

  if (s.currentTranslation) {
    s.translationEl.innerHTML = "";
    if (s.displayConfirmedTranslation) {
      const confirmedSpan = document.createElement("span");
      confirmedSpan.style.color = SPEAKER_COLORS[s.colorIndex];
      confirmedSpan.textContent = s.displayConfirmedTranslation;
      s.translationEl.appendChild(confirmedSpan);
    }
    if (s.displayPartialTranslation) {
      if (s.displayConfirmedTranslation) {
        s.translationEl.appendChild(document.createElement("br"));
      }
      const partialSpan = document.createElement("span");
      partialSpan.textContent = s.displayPartialTranslation;
      s.translationEl.appendChild(partialSpan);
    }
    s.translationEl.style.display = "block";
    s.translationEl.scrollTop = s.translationEl.scrollHeight;
  } else {
    s.translationEl.innerHTML = "";
    s.translationEl.style.display = "none";
  }

  // Adjust border radius when only one line is visible
  if (s.currentTranscript && s.currentTranslation) {
    s.transcriptEl.style.borderRadius = "6px 6px 0 0";
    s.translationEl.style.borderRadius = "0 0 6px 6px";
  } else if (s.currentTranscript) {
    s.transcriptEl.style.borderRadius = "6px";
  } else {
    s.translationEl.style.borderRadius = "6px";
  }

  s.container.style.opacity = "1";

  if (s.fadeTimeout) clearTimeout(s.fadeTimeout);
  s.fadeTimeout = window.setTimeout(() => hideSpeakerCaption(s), FADE_TIMEOUT_MS);
}

function hideSpeakerCaption(s: SpeakerCaption) {
  s.container.style.opacity = "0";
  if (s.fadeTimeout) {
    clearTimeout(s.fadeTimeout);
    s.fadeTimeout = null;
  }
}

function removeAllCaptions() {
  for (const key of Object.keys(speakers)) {
    const s = speakers[key];
    if (s.fadeTimeout) clearTimeout(s.fadeTimeout);
    s.container.remove();
    delete speakers[key];
  }
  speakerCount = 0;
  if (wrapper) {
    wrapper.remove();
    wrapper = null;
  }
}

// ─── Message Listener ───

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    sendResponse({ url: window.location.href, title: document.title });
    return true;
  }

  if (message.type === "SHOW_TRANSCRIPT_CAPTION") {
    const s = ensureSpeaker(message.speaker || "default");
    s.currentTranscript = message.confirmed || message.partial || "";
    updateSpeakerCaption(s);
    return false;
  }

  if (message.type === "SHOW_TRANSLATION_CAPTION") {
    const s = ensureSpeaker(message.speaker || "default");
    if (message.confirmed && !message.partial) {
      s.accumulatedTranslation = (s.accumulatedTranslation ? s.accumulatedTranslation + " " : "") + message.confirmed;
      s.partialTranslation = "...";
    } else if (message.partial) {
      s.partialTranslation = message.partial;
    }
    s.displayConfirmedTranslation = s.accumulatedTranslation;
    s.displayPartialTranslation = s.partialTranslation;
    s.currentTranslation = (s.displayConfirmedTranslation + " " + s.displayPartialTranslation).trim();
    updateSpeakerCaption(s);
    return false;
  }

  if (message.type === "REMOVE_CAPTION") {
    removeAllCaptions();
    return false;
  }

  if (message.type === "START_VIDEO_DELAY") {
    videoDelayer.start(message.delayMs);
    return false;
  }

  if (message.type === "STOP_VIDEO_DELAY") {
    videoDelayer.stop();
    return false;
  }
});
