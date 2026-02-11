// content.ts
console.log("Content script loaded");

let captionContainer: HTMLDivElement | null = null;
let captionOuter: HTMLDivElement | null = null; // overflow:hidden, max 2 lines
let captionInner: HTMLDivElement | null = null; // grows with all text

let hideTimeout: number | null = null;
let currentDisplayText = "";
let typewriterTimer: number | null = null;
let typewriterQueue = "";
let typewriterIndex = 0;

const CHAR_DELAY = 25;
const LINE_HEIGHT = 30; // px per line
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
  captionOuter.id = "ast-caption-outer";
  captionOuter.style.cssText = `
    background: rgba(0, 0, 0, 0.85);
    border-radius: 8px;
    padding: 10px 20px;
    max-height: ${MAX_HEIGHT + 20}px;
    overflow: hidden;
    position: relative;
  `;

  captionInner = document.createElement("div");
  captionInner.id = "ast-caption-inner";
  captionInner.style.cssText = `
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    font-weight: 500;
    line-height: ${LINE_HEIGHT}px;
    text-align: left;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    word-break: keep-all;
    transition: transform 0.3s ease;
  `;

  captionOuter.appendChild(captionInner);
  captionContainer.appendChild(captionOuter);
  document.body.appendChild(captionContainer);
}

function scrollToBottom() {
  if (!captionInner || !captionOuter) return;

  // How tall is the inner content?
  const innerHeight = captionInner.scrollHeight;
  const visibleHeight = MAX_HEIGHT;

  if (innerHeight > visibleHeight) {
    // Shift inner upward so the bottom is visible
    const offset = -(innerHeight - visibleHeight);
    captionInner.style.transform = `translateY(${offset}px)`;
  } else {
    captionInner.style.transform = "translateY(0)";
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
  if (!newChars || !captionInner) return;

  typewriterQueue = newChars;
  typewriterIndex = 0;

  typewriterTimer = window.setInterval(() => {
    if (!captionInner || typewriterIndex >= typewriterQueue.length) {
      stopTypewriter();
      return;
    }

    currentDisplayText += typewriterQueue[typewriterIndex];
    captionInner.textContent = currentDisplayText;
    typewriterIndex++;

    // Scroll as we type
    scrollToBottom();

    if (typewriterIndex >= typewriterQueue.length) {
      stopTypewriter();
    }
  }, CHAR_DELAY);
}

function showCaption(text: string) {
  if (!captionContainer) createCaptionOverlay();
  if (!captionInner || !captionOuter || !captionContainer) return;

  if (!text) {
    captionContainer.style.opacity = "0";
    currentDisplayText = "";
    stopTypewriter();
    return;
  }

  // No truncation — we show everything, the outer box clips to 2 lines
  const newText = text;

  // Compare against full target (including chars still being typed)
  const fullCurrent = currentDisplayText + typewriterQueue.slice(typewriterIndex);

  if (newText === fullCurrent) return;

  stopTypewriter();

  const divergePoint = findDivergence(fullCurrent, newText);
  const stableText = newText.slice(0, divergePoint);
  const newChars = newText.slice(divergePoint);

  // Set stable prefix instantly
  currentDisplayText = stableText;
  captionInner.textContent = stableText;
  captionContainer.style.opacity = "1";

  // Scroll to show latest
  scrollToBottom();

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (newChars.length > 0) {
    if (newChars.length > 50) {
      // Too many chars — show most instantly, typewrite last 30
      const instantPart = newChars.slice(0, newChars.length - 30);
      currentDisplayText += instantPart;
      captionInner.textContent = currentDisplayText;
      scrollToBottom();
      startTypewriter(newChars.slice(newChars.length - 30));
    } else {
      startTypewriter(newChars);
    }
  }
}

function removeCaptionOverlay() {
  if (captionContainer) {
    captionContainer.remove();
    captionContainer = null;
    captionOuter = null;
    captionInner = null;
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  stopTypewriter();
  currentDisplayText = "";
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    sendResponse({ url: window.location.href, title: document.title });
    return true;
  }

  if (message.type === "SHOW_CAPTION") {
    showCaption(message.text || "");
    return false;
  }

  if (message.type === "HIDE_CAPTION") {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = window.setTimeout(() => {
      if (captionContainer) captionContainer.style.opacity = "0";
    }, message.delay || 3000);
    return false;
  }

  if (message.type === "REMOVE_CAPTION") {
    removeCaptionOverlay();
    return false;
  }
});
