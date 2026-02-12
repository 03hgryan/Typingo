// content.ts
console.log("Content script loaded");

let captionContainer: HTMLDivElement | null = null;
let hideTimeout: number | null = null;

const SPEAKER_COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb923c"];

interface SpeakerBox {
  el: HTMLDivElement;
  prevLine: HTMLDivElement;
  confirmedLine: HTMLDivElement;
  partialSpan: HTMLSpanElement;
  prevFadeTimeout: number | null;
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

  const confirmedLine = document.createElement("div");
  confirmedLine.style.color = "#fff";

  const partialSpan = document.createElement("span");
  partialSpan.style.color = "#999";
  confirmedLine.appendChild(partialSpan);

  el.appendChild(prevLine);
  el.appendChild(confirmedLine);
  captionContainer!.appendChild(el);

  const box: SpeakerBox = {
    el,
    prevLine,
    confirmedLine,
    partialSpan,
    prevFadeTimeout: null,
  };

  speakers.set(speakerId, box);
  return box;
}

function showCaption(confirmed: string, partial: string, speaker?: string, prevConfirmed?: string) {
  if (!captionContainer) createCaptionContainer();
  if (!captionContainer) return;

  const speakerId = speaker || "default";
  const box = getOrCreateSpeakerBox(speakerId);

  if (!confirmed && !partial) {
    box.el.style.display = "none";
    const anyVisible = Array.from(speakers.values()).some((b) => b.el.style.display !== "none");
    if (!anyVisible) {
      captionContainer.style.opacity = "0";
    }
    return;
  }

  box.el.style.display = "";
  captionContainer.style.opacity = "1";

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

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
  // Set text before the partial span
  const textNode = box.confirmedLine.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    textNode.textContent = confirmed;
  } else {
    box.confirmedLine.insertBefore(document.createTextNode(confirmed), box.partialSpan);
  }

  // --- Partial text ---
  box.partialSpan.textContent = partial ? " " + partial : "";
}

function removeCaptionOverlay() {
  for (const box of speakers.values()) {
    if (box.prevFadeTimeout) {
      clearTimeout(box.prevFadeTimeout);
      box.prevFadeTimeout = null;
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

  if (message.type === "SHOW_CAPTION") {
    showCaption(message.confirmed || "", message.partial || "", message.speaker, message.prevConfirmed);
    return false;
  }

  if (message.type === "REMOVE_CAPTION") {
    removeCaptionOverlay();
    return false;
  }
});
