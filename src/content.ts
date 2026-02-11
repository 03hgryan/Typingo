// content.ts
console.log("Content script loaded");

let captionContainer: HTMLDivElement | null = null;
let captionOuter: HTMLDivElement | null = null;
let confirmedSpan: HTMLSpanElement | null = null;
let partialSpan: HTMLSpanElement | null = null;

let hideTimeout: number | null = null;
let currentConfirmedDisplay = "";
let typewriterTimer: number | null = null;
let typewriterQueue = "";
let typewriterIndex = 0;
let targetConfirmed = "";

const CHAR_DELAY = 25;
const LINE_HEIGHT = 30;
const MAX_LINES = 2;
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;

function createCaptionOverlay() {
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
    opacity: 0;
    transition: opacity 0.2s ease;
  `;

  captionOuter = document.createElement("div");
  captionOuter.style.cssText = `
    background: rgba(0, 0, 0, 0.85);
    border-radius: 8px;
    padding: 10px 20px;
    max-height: ${MAX_HEIGHT + 20}px;
    overflow: hidden;
    position: relative;
  `;

  const inner = document.createElement("div");
  inner.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    font-weight: 500;
    line-height: ${LINE_HEIGHT}px;
    text-align: left;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    word-break: keep-all;
    transition: transform 0.3s ease;
  `;

  confirmedSpan = document.createElement("span");
  confirmedSpan.style.color = "#fff";

  partialSpan = document.createElement("span");
  partialSpan.style.color = "#999";

  inner.appendChild(confirmedSpan);
  inner.appendChild(partialSpan);
  captionOuter.appendChild(inner);
  captionContainer.appendChild(captionOuter);
  document.body.appendChild(captionContainer);
}

function scrollToBottom() {
  if (!captionOuter) return;
  const inner = captionOuter.firstElementChild as HTMLElement;
  if (!inner) return;
  const innerHeight = inner.scrollHeight;
  if (innerHeight > MAX_HEIGHT) {
    inner.style.transform = `translateY(${-(innerHeight - MAX_HEIGHT)}px)`;
  } else {
    inner.style.transform = "translateY(0)";
  }
}

function findDivergence(oldText: string, newText: string): number {
  const len = Math.min(oldText.length, newText.length);
  for (let i = 0; i < len; i++) {
    if (oldText[i] !== newText[i]) return i;
  }
  return len;
}

function stopTypewriter() {
  if (typewriterTimer) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
  typewriterQueue = "";
  typewriterIndex = 0;
}

function startTypewriter(newChars: string) {
  stopTypewriter();
  if (!newChars || !confirmedSpan) return;

  typewriterQueue = newChars;
  typewriterIndex = 0;

  typewriterTimer = window.setInterval(() => {
    if (!confirmedSpan || typewriterIndex >= typewriterQueue.length) {
      stopTypewriter();
      return;
    }

    currentConfirmedDisplay += typewriterQueue[typewriterIndex];
    confirmedSpan.textContent = currentConfirmedDisplay;
    typewriterIndex++;
    scrollToBottom();

    if (typewriterIndex >= typewriterQueue.length) {
      stopTypewriter();
    }
  }, CHAR_DELAY);
}

function showCaption(confirmed: string, partial: string) {
  if (!captionContainer) createCaptionOverlay();
  if (!confirmedSpan || !partialSpan || !captionContainer) return;

  if (!confirmed && !partial) {
    captionContainer.style.opacity = "0";
    currentConfirmedDisplay = "";
    targetConfirmed = "";
    stopTypewriter();
    return;
  }

  captionContainer.style.opacity = "1";

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // --- Confirmed text: typewriter effect ---
  if (confirmed !== targetConfirmed) {
    targetConfirmed = confirmed;

    // Include chars still being typed in comparison
    const fullCurrent = currentConfirmedDisplay + typewriterQueue.slice(typewriterIndex);
    stopTypewriter();

    const divergePoint = findDivergence(fullCurrent, confirmed);
    const stableText = confirmed.slice(0, divergePoint);
    const newChars = confirmed.slice(divergePoint);

    currentConfirmedDisplay = stableText;
    confirmedSpan.textContent = stableText;

    if (newChars.length > 0) {
      if (newChars.length > 50) {
        const instantPart = newChars.slice(0, newChars.length - 30);
        currentConfirmedDisplay += instantPart;
        confirmedSpan.textContent = currentConfirmedDisplay;
        startTypewriter(newChars.slice(newChars.length - 30));
      } else {
        startTypewriter(newChars);
      }
    }
  }

  // --- Partial text: instant, no typewriter ---
  if (partial) {
    partialSpan.textContent = " " + partial;
  } else {
    partialSpan.textContent = "";
  }

  scrollToBottom();
}

function removeCaptionOverlay() {
  if (captionContainer) {
    captionContainer.remove();
    captionContainer = null;
    captionOuter = null;
    confirmedSpan = null;
    partialSpan = null;
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  stopTypewriter();
  currentConfirmedDisplay = "";
  targetConfirmed = "";
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    sendResponse({ url: window.location.href, title: document.title });
    return true;
  }

  if (message.type === "SHOW_CAPTION") {
    showCaption(message.confirmed || "", message.partial || "");
    return false;
  }

  if (message.type === "REMOVE_CAPTION") {
    removeCaptionOverlay();
    return false;
  }
});
