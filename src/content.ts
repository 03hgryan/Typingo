// content.ts
console.log("Content script loaded");

// Caption overlay state
let captionContainer: HTMLDivElement | null = null;
let captionText: HTMLDivElement | null = null;
let captionSource: HTMLDivElement | null = null;
let hideTimeout: number | null = null;

function createCaptionOverlay() {
  if (captionContainer) return;

  // Create container
  captionContainer = document.createElement("div");
  captionContainer.id = "ast-caption-container";
  captionContainer.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    max-width: 80%;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;

  // Source text (English - smaller, above)
  captionSource = document.createElement("div");
  captionSource.id = "ast-caption-source";
  captionSource.style.cssText = `
    background: rgba(0, 0, 0, 0.6);
    color: #aaa;
    padding: 4px 12px;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    text-align: center;
    max-width: 100%;
  `;

  // Translated text (Korean - larger, below)
  captionText = document.createElement("div");
  captionText.id = "ast-caption-text";
  captionText.style.cssText = `
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    padding: 8px 16px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    font-weight: 500;
    line-height: 1.5;
    text-align: center;
    max-width: 100%;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  `;

  captionContainer.appendChild(captionSource);
  captionContainer.appendChild(captionText);
  document.body.appendChild(captionContainer);
}

function showCaption(source: string, translated: string, isStreaming: boolean = false) {
  if (!captionContainer) {
    createCaptionOverlay();
  }

  if (captionSource && captionText && captionContainer) {
    captionSource.textContent = source;
    captionText.textContent = translated;

    // Hide source element if empty
    captionSource.style.display = source ? "block" : "none";

    // Style differently when streaming
    if (isStreaming) {
      captionText.style.color = "#ffcc00";
    } else {
      captionText.style.color = "#fff";
    }

    captionContainer.style.opacity = "1";

    // Clear any existing hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
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
    captionText = null;
    captionSource = null;
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
    };
    sendResponse(pageInfo);
    return true;
  }

  // Caption messages
  if (message.type === "SHOW_CAPTION") {
    showCaption(message.source, message.translated, message.isStreaming);
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
