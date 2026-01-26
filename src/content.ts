// content.ts
console.log("Content script loaded");

// Caption overlay state
let captionContainer: HTMLDivElement | null = null;
let confirmedSpan: HTMLSpanElement | null = null;
let liveSpan: HTMLSpanElement | null = null;
let hideTimeout: number | null = null;

// Inject styles
function injectStyles() {
  if (document.getElementById("ast-caption-styles")) return;

  const style = document.createElement("style");
  style.id = "ast-caption-styles";
  style.textContent = `
    .ast-confirmed {
      color: #4ade80;
    }

    .ast-live {
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

function createCaptionOverlay() {
  if (captionContainer) return;

  injectStyles();

  captionContainer = document.createElement("div");
  captionContainer.id = "ast-caption-container";
  captionContainer.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    max-width: 80%;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;

  const captionBox = document.createElement("div");
  captionBox.id = "ast-caption-box";
  captionBox.style.cssText = `
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    font-weight: 500;
    line-height: 1.6;
    text-align: center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    min-width: 100px;
    min-height: 28px;
  `;

  confirmedSpan = document.createElement("span");
  confirmedSpan.className = "ast-confirmed";

  liveSpan = document.createElement("span");
  liveSpan.className = "ast-live";

  captionBox.appendChild(confirmedSpan);
  captionBox.appendChild(liveSpan);
  captionContainer.appendChild(captionBox);
  document.body.appendChild(captionContainer);
}

function showCaption(confirmed: string, live: string) {
  if (!captionContainer) {
    createCaptionOverlay();
  }

  if (!confirmedSpan || !liveSpan || !captionContainer) return;

  // Update text
  confirmedSpan.textContent = confirmed;
  liveSpan.textContent = live ? (confirmed ? " " + live : live) : "";

  // Show/hide based on content
  const hasContent = confirmed || live;
  captionContainer.style.opacity = hasContent ? "1" : "0";

  // Clear any pending hide
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function hideCaption(delay: number = 3000) {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }

  hideTimeout = window.setTimeout(() => {
    if (captionContainer) {
      captionContainer.style.opacity = "0";
    }
  }, delay);
}

function removeCaptionOverlay() {
  if (captionContainer) {
    captionContainer.remove();
    captionContainer = null;
    confirmedSpan = null;
    liveSpan = null;
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // Remove injected styles
  const styles = document.getElementById("ast-caption-styles");
  if (styles) styles.remove();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    sendResponse({
      url: window.location.href,
      title: document.title,
    });
    return true;
  }

  if (message.type === "SHOW_CAPTION") {
    showCaption(message.confirmed || "", message.pending || message.live || "");
    return false;
  }

  if (message.type === "HIDE_CAPTION") {
    hideCaption(message.delay || 3000);
    return false;
  }

  if (message.type === "REMOVE_CAPTION") {
    removeCaptionOverlay();
    return false;
  }
});
