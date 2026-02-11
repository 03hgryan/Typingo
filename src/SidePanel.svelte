<script lang="ts">
  import { onMount } from "svelte";

  let isCapturing = $state(false);
  let errorMessage = $state<string | null>(null);

  let transcript = $state("");
  let combinedText = $state("");
  let liveTranslation = $state("");

  function clearError() {
    errorMessage = null;
  }

  function resetState() {
    transcript = "";
    combinedText = "";
    liveTranslation = "";
  }

  async function toggleCapture() {
    if (!isCapturing) {
      chrome.runtime.sendMessage({ type: "START_CAPTURE" }, (response) => {
        if (response?.success) {
          errorMessage = null;
          resetState();
        } else {
          errorMessage = `Failed to start: ${response?.error || "Unknown error"}`;
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, (response) => {
        if (response?.success) {
          isCapturing = false;
        }
      });
    }
  }

  onMount(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "TRANSCRIPT") {
        transcript = message.text || "";
      }

      if (message.type === "COMBINED") {
        combinedText = message.text || "";
      }

      if (message.type === "TRANSLATION") {
        liveTranslation = message.text || "";
      }

      if (message.type === "CAPTURE_STARTED") {
        isCapturing = true;
        errorMessage = null;
        resetState();
      }

      if (message.type === "CAPTURE_STOPPED") {
        isCapturing = false;
      }

      if (message.type === "CAPTURE_ERROR") {
        isCapturing = false;
        errorMessage = `Capture error: ${message.error}`;
      }

      if (message.type === "WS_ERROR") {
        errorMessage = `Connection error: ${message.error}`;
      }

      if (message.type === "ERROR") {
        errorMessage = `Server error: ${message.message}`;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_CAPTURE_STATE" }, (response) => {
      if (response?.isCapturing) {
        isCapturing = true;
      }
    });
  });
</script>

<div class="container">
  <header>
    <h1>🎙️ Live Translation</h1>
    <span class="status" class:active={isCapturing}>
      {isCapturing ? "● Recording" : "○ Idle"}
    </span>
  </header>

  <button class="capture-btn" class:active={isCapturing} onclick={toggleCapture}>
    {isCapturing ? "⏹ Stop" : "▶ Start"}
  </button>

  {#if errorMessage}
    <div class="error">
      <span>{errorMessage}</span>
      <button onclick={clearError}>×</button>
    </div>
  {/if}

  <!-- Combined Translation -->
  <div class="section">
    <div class="label">Translation</div>
    <div class="translation-box">
      {#if !combinedText && !liveTranslation}
        <span class="placeholder">Waiting for speech...</span>
      {:else}
        <span class="combined">{combinedText}</span>
        {#if liveTranslation}
          <div class="live-preview">{liveTranslation}</div>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Raw Transcript (collapsible) -->
  <details class="transcript-details">
    <summary>Raw transcript</summary>
    <p>{transcript || "—"}</p>
  </details>
</div>

<style>
  .container {
    padding: 16px;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    height: 100vh;
    background: #0a0a0a;
    color: #fff;
    overflow-y: auto;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 1.1rem;
    margin: 0;
    font-weight: 600;
  }

  .status {
    font-size: 0.7rem;
    color: #666;
    padding: 4px 10px;
    border-radius: 12px;
    background: #1a1a1a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status.active {
    color: #fff;
    background: #dc2626;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .capture-btn {
    width: 100%;
    padding: 14px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
  }

  .capture-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .capture-btn.active {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  }

  .error {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid rgba(220, 38, 38, 0.3);
    padding: 10px 14px;
    border-radius: 8px;
    margin-top: 12px;
    font-size: 0.85rem;
    color: #fca5a5;
  }

  .error button {
    background: none;
    border: none;
    color: #fca5a5;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
  }

  .section {
    margin-top: 20px;
  }

  .label {
    font-size: 0.7rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .translation-box {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 16px;
    min-height: 120px;
    font-size: 1.1rem;
    line-height: 1.7;
  }

  .placeholder {
    color: #333;
    font-style: italic;
  }

  .combined {
    color: #e2e8f0;
  }

  .live-preview {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #222;
    color: #64748b;
    font-size: 0.9rem;
  }

  .transcript-details {
    margin-top: 20px;
    font-size: 0.8rem;
    color: #555;
  }

  .transcript-details summary {
    cursor: pointer;
    padding: 8px 0;
    user-select: none;
  }

  .transcript-details p {
    background: #111;
    border-radius: 8px;
    padding: 12px;
    margin-top: 8px;
    line-height: 1.5;
  }
</style>
