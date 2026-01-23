<script lang="ts">
  import { onMount } from "svelte";
  import type { FinalizedSegment, LiveSegment } from "./types/transcript";
  import type { AudioChunk } from "./audio/types";

  let isCapturing = $state(false);

  // Production-level state separation (critical!)
  let finalizedSegments = $state<FinalizedSegment[]>([]); // Immutable history
  let liveSegment = $state<LiveSegment | null>(null); // Mutable active segment

  // Translation state (paired source + translated)
  interface TranslationPair {
    source: string;
    translated: string;
  }
  let liveTranslation = $state<TranslationPair | null>(null); // Current streaming translation
  let completedTranslations = $state<TranslationPair[]>([]); // Finalized translations

  // Reference to translation container for auto-scroll
  let translationContainer: HTMLDivElement;

  let logs = $state<string[]>([]);
  let showLogs = $state(false); // Collapsible logs

  // Audio capture state
  let audioContext: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let mediaStream: MediaStream | null = null;

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, `[${timestamp}] ${message}`];
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }
  }

  function scrollToBottom() {
    if (translationContainer) {
      translationContainer.scrollTop = translationContainer.scrollHeight;
    }
  }

  async function startAudioCapture(streamId: string) {
    try {
      addLog("Starting audio capture with stream ID...");

      // Use the stream ID to get the media stream
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-expect-error - Chrome-specific constraint
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
          },
        },
        video: false,
      });

      audioContext = new AudioContext({ sampleRate: 48000 });

      // Load audioWorklet from public folder
      await audioContext.audioWorklet.addModule(chrome.runtime.getURL("public/audioWorklet.js"));

      const source = audioContext.createMediaStreamSource(mediaStream);

      workletNode = new AudioWorkletNode(audioContext, "audio-worklet");

      workletNode.port.onmessage = (e) => {
        const chunk = e.data as AudioChunk;
        // Convert Int16Array to regular array for Chrome messaging
        const chunkData = {
          pcm: Array.from(chunk.pcm),
          chunk_index: chunk.chunk_index,
          duration_ms: chunk.duration_ms,
        };

        // Send audio chunks to background
        chrome.runtime.sendMessage({
          type: "AUDIO_CHUNK",
          chunk: chunkData,
        });
      };

      // Connect to worklet for processing
      source.connect(workletNode);

      // ALSO connect to speakers so audio isn't muted
      source.connect(audioContext.destination);

      addLog("Audio capture started successfully!");
    } catch (error) {
      addLog("Failed to start audio capture: " + error);
      console.error("Audio capture error:", error);
    }
  }

  function stopAudioCapture() {
    if (workletNode) {
      workletNode.disconnect();
      workletNode.port.onmessage = null;
      workletNode = null;
    }

    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;

    audioContext?.close();
    audioContext = null;

    addLog("Audio capture stopped");
  }

  async function toggleCapture() {
    addLog("Button clicked! isCapturing: " + isCapturing);

    if (!isCapturing) {
      // START: Request background to start capture
      try {
        addLog("Requesting capture start...");

        // Send message to background to start capture
        chrome.runtime.sendMessage({ type: "START_CAPTURE" }, (response) => {
          if (response?.success) {
            // The actual capture will start when we receive START_CAPTURE_WITH_STREAM_ID
            addLog("Capture request sent, waiting for stream ID...");
          } else {
            addLog("Failed to start: " + (response?.error || "Unknown error"));
          }
        });
      } catch (error) {
        addLog("Failed: " + error);
      }
    } else {
      // STOP: Request background to stop capture
      addLog("Stopping...");
      stopAudioCapture();

      chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, (response) => {
        if (response?.success) {
          isCapturing = false;
          addLog("Stopped");
        }
      });
    }
  }

  onMount(() => {
    addLog("Side panel ready");

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
      // Handle live segment updates (mutable)
      if (message.type === "SEGMENTS_UPDATE") {
        const seg = message.payload.segments[0] as LiveSegment;

        // Always replace live segment (never append)
        liveSegment = seg;

        addLog(`Rev ${seg.revision}: "${seg.committed}" | "${seg.partial}"`);

        // Debug logging
        console.log("LIVE:", liveSegment);
      }

      // Handle finalized segments (immutable)
      if (message.type === "SEGMENTS_FINALIZED") {
        const finalized = message.payload.segments[0] as FinalizedSegment;

        // Check if we already have this segment (by segment_id)
        const exists = finalizedSegments.some((s) => s.segment_id === finalized.segment_id);

        if (!exists) {
          // Assign segment_index if not present
          const newSegment: FinalizedSegment = {
            ...finalized,
            segment_index: finalized.segment_index ?? finalizedSegments.length,
          };

          // Append-only (never update existing)
          finalizedSegments = [...finalizedSegments, newSegment];

          addLog(`Final [${newSegment.segment_index}]: "${newSegment.text}"`);
        }

        // Clear live segment if it belongs to this finalized segment
        if (liveSegment?.segment_id === finalized.segment_id) {
          liveSegment = null;
        }

        // Debug logging
        console.log(
          "FINAL:",
          finalizedSegments.map((s) => s.text)
        );
      }

      // Handle final transcript (on stream end)
      if (message.type === "TRANSCRIPT_FINAL") {
        addLog(`Final transcript: "${message.payload.transcript}"`);
        console.log("TRANSCRIPT_FINAL:", message.payload);
      }

      if (message.type === "WS_CONNECTED") {
        addLog("WebSocket connected");
      }

      if (message.type === "WS_DISCONNECTED") {
        addLog("WebSocket disconnected");

        // Clear live segment on disconnect (keep finalized)
        liveSegment = null;
        liveTranslation = null;
      }

      // Handle translation messages
      if (message.type === "TRANSLATION_DELTA") {
        // Streaming translation update with source and translated
        liveTranslation = {
          source: message.payload.source || "",
          translated: message.payload.translated || "",
        };
        addLog(`Translation delta: "${message.payload.delta}"`);
        // Auto-scroll after DOM updates
        setTimeout(scrollToBottom, 0);
      }

      if (message.type === "TRANSLATION_COMPLETE") {
        // Final translation - move to completed list
        const pair: TranslationPair = {
          source: message.payload.source || "",
          translated: message.payload.translated || "",
        };
        if (pair.translated) {
          completedTranslations = [...completedTranslations, pair];
          addLog(`Translation complete: "${pair.source}" → "${pair.translated}"`);
        }
        liveTranslation = null;
        // Auto-scroll after DOM updates
        setTimeout(scrollToBottom, 0);
      }

      if (message.type === "TRANSLATION_ERROR") {
        addLog(`Translation error: ${message.payload.message}`);
        liveTranslation = null;
      }

      // Handle capture state updates from background
      if (message.type === "CAPTURE_STARTED") {
        isCapturing = true;
        addLog("Capture started");
      }

      if (message.type === "CAPTURE_STOPPED") {
        isCapturing = false;
        stopAudioCapture();
        addLog("Capture stopped");
      }

      // Handle stream ID from background to start audio capture
      if (message.type === "START_CAPTURE_WITH_STREAM_ID") {
        addLog("Received stream ID, starting capture...");
        startAudioCapture(message.streamId);
        isCapturing = true;
      }
    });

    // Check current capture state on mount
    chrome.runtime.sendMessage({ type: "GET_CAPTURE_STATE" }, (response) => {
      if (response?.isCapturing) {
        isCapturing = true;
        addLog("Reconnected to active capture session");
      }
    });
  });
</script>

<div class="container">
  <header>
    <h1>Live Translation</h1>
  </header>

  <button class="capture-btn" class:active={isCapturing} onclick={toggleCapture}>
    {isCapturing ? "Stop Capture" : "Start Capture"}
  </button>

  <!-- Translation Section -->
  <div class="section">
    <h2 class="section-title">Translations</h2>
    <div class="translation-container" bind:this={translationContainer}>
      {#if completedTranslations.length === 0 && !liveTranslation}
        <p class="empty">Waiting for translation...</p>
      {:else}
        <div class="translation-list">
          <!-- Completed translation pairs -->
          {#each completedTranslations as pair}
            <div class="translation-pair">
              <div class="source-text">{pair.source}</div>
              <div class="translated-text">{pair.translated}</div>
            </div>
          {/each}

          <!-- Live translation pair -->
          {#if liveTranslation}
            <div class="translation-pair live">
              <div class="source-text">{liveTranslation.source}</div>
              <div class="translated-text streaming">{liveTranslation.translated}</div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Debug Logs (collapsible) -->
  <div class="logs-section">
    <button class="logs-toggle" onclick={() => (showLogs = !showLogs)}>
      {showLogs ? "▼" : "▶"} Debug Logs ({logs.length})
    </button>

    {#if showLogs}
      <div class="logs">
        {#each logs as log}
          <div class="log-entry">{log}</div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    padding: 1rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    height: 100vh;
    overflow-y: auto;
    box-sizing: border-box;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h1 {
    color: #2c3e50;
    font-size: 1.1rem;
    margin: 0;
  }

  .capture-btn {
    width: 100%;
    padding: 12px;
    font-size: 16px;
    font-weight: 600;
    border: 2px solid #3498db;
    background: white;
    color: #3498db;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1rem;
  }

  .capture-btn:hover {
    background: #3498db;
    color: white;
  }

  .capture-btn.active {
    background: #e74c3c;
    border-color: #e74c3c;
    color: white;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* Section styles */
  .section {
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #7f8c8d;
    margin: 0 0 0.5rem 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .empty {
    color: #95a5a6;
    font-style: italic;
    text-align: center;
    padding: 2rem;
    margin: 0;
  }

  /* Translation styles */
  .translation-container {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 0.75rem;
    min-height: 80px;
    max-height: 300px;
    overflow-y: auto;
  }

  .translation-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .translation-pair {
    background: white;
    border-radius: 6px;
    padding: 0.75rem;
    border-left: 3px solid #3498db;
  }

  .translation-pair.live {
    border-left-color: #f39c12;
    background: #fffdf5;
  }

  .source-text {
    font-size: 0.85rem;
    color: #7f8c8d;
    margin-bottom: 0.4rem;
    line-height: 1.5;
  }

  .translated-text {
    font-size: 0.95rem;
    color: #1a5276;
    font-weight: 500;
    line-height: 1.6;
  }

  .translated-text.streaming {
    color: #d35400;
    animation: pulse-translation 1.5s infinite;
  }

  @keyframes pulse-translation {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* Logs section */
  .logs-section {
    border-top: 1px solid #ecf0f1;
    padding-top: 0.5rem;
  }

  .logs-toggle {
    background: none;
    border: none;
    color: #7f8c8d;
    font-size: 0.8rem;
    cursor: pointer;
    padding: 4px 0;
  }

  .logs-toggle:hover {
    color: #34495e;
  }

  .logs {
    max-height: 150px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.7rem;
    background: #f8f9fa;
    border-radius: 4px;
    padding: 0.5rem;
    margin-top: 0.5rem;
  }

  .log-entry {
    padding: 2px 0;
    color: #5a6268;
    border-bottom: 1px solid #ecf0f1;
  }

  .log-entry:last-child {
    border-bottom: none;
  }
</style>
