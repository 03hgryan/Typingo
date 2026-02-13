// content.ts
console.log("Content script loaded");

let captionContainer: HTMLDivElement | null = null;
let hideTimeout: number | null = null;

const SPEAKER_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#a78bfa",
  "#fb923c",
];

const SILENCE_TIMEOUT_MS = 5_000;

interface SpeakerBox {
  el: HTMLDivElement;
  prevLine: HTMLDivElement;
  transcriptLine: HTMLDivElement;
  transcriptPartialSpan: HTMLSpanElement;
  confirmedLine: HTMLDivElement;
  partialSpan: HTMLSpanElement;
  prevFadeTimeout: number | null;
  silenceTimeout: number | null;
}

const speakers = new Map<string, SpeakerBox>();
let speakerOrder: string[] = [];

function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

function createCaptionContainer() {
  if (captionContainer) return;

  captionContainer = document.createElement("div");
  captionContainer.id = "ast-caption-container";
  captionContainer.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    width: 75%;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;

  document.body.appendChild(captionContainer);
}

function getOrCreateSpeakerBox(speakerId: string): SpeakerBox {
  const existing = speakers.get(speakerId);
  if (existing) return existing;

  if (!captionContainer) createCaptionContainer();

  const colorIndex = speakerOrder.length;
  speakerOrder.push(speakerId);

  const el = document.createElement("div");
  el.style.cssText = `
    background: rgba(0, 0, 0, 0.85);
    border-radius: 8px;
    padding: 10px 20px;
    width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    font-weight: 500;
    line-height: 28px;
    text-align: left;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    word-break: keep-all;
    ${speakerId !== "default" ? `border-left: 3px solid ${getSpeakerColor(colorIndex)};` : ""}
  `;

  if (speakerId !== "default") {
    const label = document.createElement("div");
    label.textContent = speakerId;
    label.style.cssText = `color: ${getSpeakerColor(colorIndex)}; font-weight: 700; font-size: 12px; margin-bottom: 4px;`;
    el.appendChild(label);
  }

  const prevLine = document.createElement("div");
  prevLine.style.cssText = `color: #888; display: none;`;

  const transcriptLine = document.createElement("div");
  transcriptLine.style.cssText = `color: #8ab4f8; font-size: 0.85em; opacity: 0.8;`;

  const transcriptPartialSpan = document.createElement("span");
  transcriptPartialSpan.style.color = "#5a8ac0";
  transcriptLine.appendChild(transcriptPartialSpan);

  const confirmedLine = document.createElement("div");
  confirmedLine.style.color = "#fff";

  const partialSpan = document.createElement("span");
  partialSpan.style.color = "#999";
  confirmedLine.appendChild(partialSpan);

  el.appendChild(prevLine);
  el.appendChild(transcriptLine);
  el.appendChild(confirmedLine);
  captionContainer!.appendChild(el);

  const box: SpeakerBox = {
    el,
    prevLine,
    transcriptLine,
    transcriptPartialSpan,
    confirmedLine,
    partialSpan,
    prevFadeTimeout: null,
    silenceTimeout: null,
  };

  speakers.set(speakerId, box);
  return box;
}

function hideSpeakerBox(speakerId: string) {
  const box = speakers.get(speakerId);
  if (!box || !captionContainer) return;

  box.el.style.display = "none";
  if (box.silenceTimeout) {
    clearTimeout(box.silenceTimeout);
    box.silenceTimeout = null;
  }

  const anyVisible = Array.from(speakers.values()).some(
    (b) => b.el.style.display !== "none",
  );
  if (!anyVisible) {
    captionContainer.style.opacity = "0";
  }
}

function showSpeakerBox(speakerId: string) {
  if (!captionContainer) createCaptionContainer();
  if (!captionContainer) return null;

  const box = getOrCreateSpeakerBox(speakerId);
  box.el.style.display = "";
  captionContainer.style.opacity = "1";

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (box.silenceTimeout) {
    clearTimeout(box.silenceTimeout);
  }
  box.silenceTimeout = window.setTimeout(() => {
    hideSpeakerBox(speakerId);
    box.silenceTimeout = null;
  }, SILENCE_TIMEOUT_MS);

  return box;
}

function showTranslationCaption(
  confirmed: string,
  partial: string,
  speaker?: string,
  prevConfirmed?: string,
) {
  const speakerId = speaker || "default";

  if (!confirmed && !partial) {
    hideSpeakerBox(speakerId);
    return;
  }

  const box = showSpeakerBox(speakerId);
  if (!box) return;

  // --- Previous confirmed ---
  if (prevConfirmed) {
    if (box.prevFadeTimeout) {
      clearTimeout(box.prevFadeTimeout);
      box.prevFadeTimeout = null;
    }
    box.prevLine.textContent = prevConfirmed;
    box.prevLine.style.display = "";

    box.prevFadeTimeout = window.setTimeout(() => {
      box.prevLine.style.display = "none";
      box.prevLine.textContent = "";
      box.prevFadeTimeout = null;
    }, 3000);
  }

  // --- Confirmed text ---
  const textNode = box.confirmedLine.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    textNode.textContent = confirmed;
  } else {
    box.confirmedLine.insertBefore(
      document.createTextNode(confirmed),
      box.partialSpan,
    );
  }

  // --- Partial text ---
  box.partialSpan.textContent = partial ? " " + partial : "";
}

function showTranscriptCaption(
  confirmed: string,
  partial: string,
  speaker?: string,
  prevConfirmed?: string,
) {
  const speakerId = speaker || "default";

  if (!confirmed && !partial) return;

  const box = showSpeakerBox(speakerId);
  if (!box) return;

  // --- Transcript confirmed ---
  const transcriptNode = box.transcriptLine.firstChild;
  if (transcriptNode && transcriptNode.nodeType === Node.TEXT_NODE) {
    transcriptNode.textContent = confirmed;
  } else {
    box.transcriptLine.insertBefore(
      document.createTextNode(confirmed),
      box.transcriptPartialSpan,
    );
  }

  // --- Transcript partial ---
  box.transcriptPartialSpan.textContent = partial ? " " + partial : "";
}

function removeCaptionOverlay() {
  for (const box of speakers.values()) {
    if (box.prevFadeTimeout) {
      clearTimeout(box.prevFadeTimeout);
      box.prevFadeTimeout = null;
    }
    if (box.silenceTimeout) {
      clearTimeout(box.silenceTimeout);
      box.silenceTimeout = null;
    }
  }
  speakers.clear();
  speakerOrder = [];

  if (captionContainer) {
    captionContainer.remove();
    captionContainer = null;
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    sendResponse({ url: window.location.href, title: document.title });
    return true;
  }

  if (message.type === "SHOW_TRANSLATION_CAPTION") {
    showTranslationCaption(
      message.confirmed || "",
      message.partial || "",
      message.speaker,
      message.prevConfirmed,
    );
    return false;
  }

  if (message.type === "SHOW_TRANSCRIPT_CAPTION") {
    showTranscriptCaption(
      message.confirmed || "",
      message.partial || "",
      message.speaker,
      message.prevConfirmed,
    );
    return false;
  }

  if (message.type === "REMOVE_CAPTION") {
    removeCaptionOverlay();
    return false;
  }
});
