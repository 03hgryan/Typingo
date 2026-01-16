<!-- +page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { AudioCapture } from "../../audio/audioCapture";
  import type { FinalizedSegment, LiveSegment, WordInfo } from "../../types/transcript";

  let isCapturing = $state(false);

  // Production-level state separation (critical!)
  let finalizedSegments = $state<FinalizedSegment[]>([]); // Immutable history
  let liveSegment = $state<LiveSegment | null>(null); // Mutable active segment

  let logs = $state<string[]>([]);
  let showLogs = $state(false); // Collapsible logs
  let capture: AudioCapture | null = null;

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, `[${timestamp}] ${message}`];
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }
  }

  async function toggleCapture() {
    addLog("🔘 Button clicked! isCapturing: " + isCapturing);

    if (!isCapturing) {
      // START: Capture tab audio
      try {
        addLog("🎤 Creating AudioCapture...");

        capture = new AudioCapture((chunk) => {
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
        });

        addLog("📡 Connecting WebSocket...");
        chrome.runtime.sendMessage({ type: "CONNECT_WS" });

        addLog("🎙️ Starting tab audio capture...");
        await capture.start();

        isCapturing = true;
        addLog("✅ Audio capture started!");
      } catch (error) {
        addLog("❌ Failed: " + error);
      }
    } else {
      // STOP: Stop capture
      addLog("⏹️ Stopping...");

      if (capture) {
        capture.stop();
        capture = null;
      }

      chrome.runtime.sendMessage({ type: "DISCONNECT_WS" });

      isCapturing = false;
      addLog("✅ Stopped");
    }
  }

  function copyTranscript() {
    const fullText = getFullTranscript();
    navigator.clipboard.writeText(fullText);
    addLog("📋 Transcript copied to clipboard");
  }

  function getFullTranscript(): string {
    const finalizedText = finalizedSegments.map((s) => s.text).join(" ");
    const liveText = liveSegment ? `${liveSegment.committed} ${liveSegment.partial}`.trim() : "";

    return [finalizedText, liveText].filter(Boolean).join(" ");
  }

  function getWordCount(): number {
    const finalizedWords = finalizedSegments.reduce((sum, s) => sum + (s.words?.length || 0), 0);
    const liveWords = liveSegment
      ? (liveSegment.stable_words?.length || 0) + (liveSegment.unstable_words?.length || 0)
      : 0;
    return finalizedWords + liveWords;
  }

  onMount(() => {
    addLog("✅ Popup ready");

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
      // Handle live segment updates (mutable)
      if (message.type === "SEGMENTS_UPDATE") {
        const seg = message.payload.segments[0] as LiveSegment;

        // Always replace live segment (never append)
        liveSegment = seg;

        addLog(`⏳ Rev ${seg.revision}: "${seg.committed}" | "${seg.partial}"`);

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

          addLog(`✅ Final [${newSegment.segment_index}]: "${newSegment.text}"`);
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
        addLog(`🏁 Final transcript: "${message.payload.transcript}"`);
        console.log("TRANSCRIPT_FINAL:", message.payload);
      }

      if (message.type === "WS_CONNECTED") {
        addLog("✅ WebSocket connected");
      }

      if (message.type === "WS_DISCONNECTED") {
        addLog("🔌 WebSocket disconnected");

        // Clear live segment on disconnect (keep finalized)
        liveSegment = null;
      }
    });
  });
</script>

<div class="container">
  <header>
    <h1>🎙️ ASR Transcription</h1>
    <div class="stats">
      {#if getWordCount() > 0}
        <span class="word-count">{getWordCount()} words</span>
      {/if}
    </div>
  </header>

  <button class="capture-btn" class:active={isCapturing} onclick={toggleCapture}>
    {isCapturing ? "⏹️ Stop Capture" : "🎤 Start Capture"}
  </button>

  <!-- Transcript Section -->
  <div class="transcript-container">
    {#if finalizedSegments.length === 0 && !liveSegment}
      <p class="empty">Waiting for audio...</p>
    {:else}
      <!-- Live transcript view -->
      <div class="transcript">
        <!-- Finalized text (stable, won't change) -->
        <span class="finalized-text">
          {finalizedSegments.map((s) => s.text).join(" ")}
        </span>

        <!-- Live segment -->
        {#if liveSegment}
          {#if finalizedSegments.length > 0}
            <span class="space"> </span>
          {/if}
          <span class="committed">{liveSegment.committed}</span>
          {#if liveSegment.partial}
            <span class="partial"> {liveSegment.partial}</span>
          {/if}
        {/if}
      </div>

      <!-- Actions -->
      <div class="actions">
        <button class="copy-btn" onclick={copyTranscript}> 📋 Copy Transcript </button>
      </div>
    {/if}
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
    width: 400px;
    max-height: 600px;
    overflow-y: auto;
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

  .stats {
    font-size: 0.8rem;
    color: #7f8c8d;
  }

  .word-count {
    background: #ecf0f1;
    padding: 2px 8px;
    border-radius: 10px;
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

  /* Transcript styles */
  .transcript-container {
    background: white;
    border: 1px solid #ecf0f1;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    min-height: 100px;
  }

  .empty {
    color: #95a5a6;
    font-style: italic;
    text-align: center;
    padding: 2rem;
    margin: 0;
  }

  .transcript {
    line-height: 1.8;
    font-size: 0.95rem;
    color: #2c3e50;
  }

  .finalized-text {
    color: #2c3e50;
  }

  .committed {
    color: #2c3e50;
    background: #e8f6e8;
    padding: 1px 2px;
    border-radius: 2px;
  }

  .partial {
    color: #7f8c8d;
    font-style: italic;
    background: #fff8e6;
    padding: 1px 2px;
    border-radius: 2px;
  }

  .actions {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #ecf0f1;
  }

  .copy-btn {
    padding: 8px 16px;
    font-size: 0.85rem;
    background: #ecf0f1;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .copy-btn:hover {
    background: #d5dbdb;
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
